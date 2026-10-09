import { randomInt } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { getCityByCode } from '@nakliyat/locations';
import { Prisma } from '../generated/prisma/client.js';
import { BankTransferStatus, CreditTransactionType, QuoteStatus, RequestStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DEFAULT_CREDIT_SETTINGS,
  EXPIRED_REFUND_WINDOW_DAYS,
  expiredRefund,
  isValidTrIban,
  makeTransferCode,
  normalizeCreditSettings,
  quoteCost,
  type CreditSettings,
} from './credit-rules.js';

const SETTINGS_ID = 1;
const DAY_MS = 86_400_000;
const TR_OFFSET_MS = 3 * 3_600_000;

export const INSUFFICIENT_CREDIT = 'Krediniz bu teklif için yetersiz. Kredi yükledikten sonra tekrar deneyin.';

type Tx = Prisma.TransactionClient;

interface Entry {
  companyId: string;
  type: CreditTransactionType;
  /** Artı yükleme/iade, eksi harcama */
  amount: number;
  quoteId?: string;
  requestId?: string;
  idempotencyKey?: string;
  actorId?: string;
  note?: string;
}

const TX_INCLUDE = {
  company: { select: { id: true, displayName: true } },
  actor: { select: { id: true, fullName: true } },
  request: { select: { id: true, fromCityCode: true, toCityCode: true } },
} satisfies Prisma.CreditTransactionInclude;

type TxRow = Prisma.CreditTransactionGetPayload<{ include: typeof TX_INCLUDE }>;

function toTransaction({ company, actor, request, ...t }: TxRow) {
  return {
    id: t.id,
    type: t.type,
    amount: t.amount,
    balanceAfter: t.balanceAfter,
    note: t.note,
    quoteId: t.quoteId,
    createdAt: t.createdAt,
    company,
    actor,
    request: request && {
      id: request.id,
      fromCityName: getCityByCode(request.fromCityCode)?.name ?? null,
      toCityName: getCityByCode(request.toCityCode)?.name ?? null,
    },
  };
}

/** Türkiye saatine göre içinde bulunulan ayın başlangıcı */
function monthStartTr(now: Date) {
  const tr = new Date(now.getTime() + TR_OFFSET_MS);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), 1) - TR_OFFSET_MS);
}

/**
 * Kredi defteri. Bakiye yalnızca buradan değişir: her değişiklik aynı veritabanı işleminde
 * bir defter satırı yazar, bakiye koşullu güncellendiği için eksiye düşmez.
 */
@Injectable()
export class CreditsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Ayarlar ─────────────────────────────────────────────────

  async getSettings(): Promise<{ settings: CreditSettings; updatedAt: Date | null }> {
    const row = await this.prisma.creditSettings.findUnique({ where: { id: SETTINGS_ID } });
    return { settings: normalizeCreditSettings(row?.settings), updatedAt: row?.updatedAt ?? null };
  }

  async adminSettings() {
    return { ...(await this.getSettings()), defaults: DEFAULT_CREDIT_SETTINGS };
  }

  async updateSettings(adminId: string, changes: Partial<CreditSettings>) {
    const invalid = changes.bankAccounts?.find((a) => !isValidTrIban(a.iban));
    if (invalid) throw new BadRequestException(`IBAN geçersiz: ${invalid.iban}. TR ile başlayan 26 karakterli IBAN'ı kontrol edin.`);
    const { settings: before } = await this.getSettings();
    const after = normalizeCreditSettings({ ...before, ...changes });
    await this.prisma.$transaction([
      this.prisma.creditSettings.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, settings: { ...after }, updatedById: adminId },
        update: { settings: { ...after }, updatedById: adminId },
      }),
      this.prisma.auditLog.create({
        data: { actorId: adminId, action: 'credit.settings.update', entityType: 'CreditSettings', entityId: String(SETTINGS_ID), details: { before: { ...before }, after: { ...after } } },
      }),
    ]);
    return this.adminSettings();
  }

  // ─── Bakiye ve hareketler ────────────────────────────────────

  async balance(companyId: string) {
    const account = await this.prisma.creditAccount.findUnique({ where: { companyId } });
    return account?.balance ?? 0;
  }

  /** Firma paneli: bakiye, teklif başına kredi ve (banka hesabı tanımlıysa) havale bilgileri */
  async summary(companyId: string) {
    const [{ settings }, balance] = await Promise.all([this.getSettings(), this.balance(companyId)]);
    return {
      enabled: settings.enabled,
      balance,
      creditValueTry: settings.creditValueTry,
      quoteCostLocal: settings.quoteCostLocal,
      quoteCostIntercity: settings.quoteCostIntercity,
      lowBalanceThreshold: settings.lowBalanceThreshold,
      transfer: settings.bankAccounts.length
        ? { code: await this.transferCode(companyId), minTopupTry: settings.minTopupTry, bankAccounts: settings.bankAccounts }
        : null,
    };
  }

  /** Firmanın havale açıklama kodu; yoksa üretilir (çakışırsa yeniden denenir) */
  async transferCode(companyId: string): Promise<string> {
    const account = await this.prisma.creditAccount.upsert({ where: { companyId }, create: { companyId }, update: {} });
    if (account.transferCode) return account.transferCode;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const claimed = await this.prisma.creditAccount.updateMany({
          where: { companyId, transferCode: null },
          data: { transferCode: makeTransferCode(randomInt) },
        });
        if (claimed.count === 0) break; // aynı anda başka istek üretti
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    const { transferCode } = await this.prisma.creditAccount.findUniqueOrThrow({ where: { companyId } });
    if (!transferCode) throw new Error('Havale kodu üretilemedi');
    return transferCode;
  }

  /** Talep ayrıntısında: bu talebe teklif kaç kredi, bakiye yetiyor mu */
  async forRequest(companyId: string, request: { fromCityCode: string; toCityCode: string }) {
    const [{ settings }, balance] = await Promise.all([this.getSettings(), this.balance(companyId)]);
    return { enabled: settings.enabled, cost: quoteCost(request, settings), balance };
  }

  async listTransactions(where: Prisma.CreditTransactionWhereInput, page: number, limit: number) {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.creditTransaction.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: TX_INCLUDE,
      }),
      this.prisma.creditTransaction.count({ where }),
    ]);
    return { items: rows.map(toTransaction), total, page, limit };
  }

  /** Yönetim panosu: firmalardaki toplam bakiye, bu ay ve tüm zamanlar türe göre toplamlar */
  async overview(now = new Date()) {
    const since = monthStartTr(now);
    const [{ settings }, balances, month, allTime, transfersPending] = await Promise.all([
      this.getSettings(),
      this.prisma.creditAccount.aggregate({ _sum: { balance: true }, _count: { _all: true }, where: { balance: { gt: 0 } } }),
      this.prisma.creditTransaction.groupBy({ by: ['type'], where: { createdAt: { gte: since } }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.creditTransaction.groupBy({ by: ['type'], _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.bankTransfer.count({ where: { status: BankTransferStatus.PENDING } }),
    ]);
    const byType = (rows: typeof month) =>
      Object.fromEntries(Object.values(CreditTransactionType).map((t) => {
        const row = rows.find((r) => r.type === t);
        return [t, { amount: row?._sum.amount ?? 0, count: row?._count._all ?? 0 }];
      })) as Record<CreditTransactionType, { amount: number; count: number }>;
    return {
      enabled: settings.enabled,
      creditValueTry: settings.creditValueTry,
      totalBalance: balances._sum.balance ?? 0,
      companiesWithBalance: balances._count._all,
      monthStart: since,
      month: byType(month),
      allTime: byType(allTime),
      transfersPending,
    };
  }

  // ─── Defter işlemleri ────────────────────────────────────────

  /** Teklif oluşturma işleminin içinde çağrılır; bakiye yetmezse işlem geri alınır */
  chargeQuote(tx: Tx, { companyId, quoteId, requestId, cost }: { companyId: string; quoteId: string; requestId: string; cost: number }) {
    return this.post(tx, { companyId, type: CreditTransactionType.QUOTE, amount: -cost, quoteId, requestId, idempotencyKey: `quote:${quoteId}` });
  }

  /** Teklif güncellemesi ücreti (ayar kapalıysa ya da sistem kapalıysa 0) */
  async updateCost(request: { fromCityCode: string; toCityCode: string }): Promise<number> {
    const { settings } = await this.getSettings();
    return settings.chargeQuoteUpdates ? quoteCost(request, settings) : 0;
  }

  /** Teklif güncellemesi işleminin içinde çağrılır; her güncelleme için ayrı bir hareket yazar */
  chargeQuoteUpdate(tx: Tx, { companyId, quoteId, requestId, cost, updateKey }: { companyId: string; quoteId: string; requestId: string; cost: number; updateKey: string }) {
    return this.post(tx, { companyId, type: CreditTransactionType.QUOTE, amount: -cost, quoteId, requestId, idempotencyKey: `quote-update:${updateKey}`, note: 'Teklif güncellendi' });
  }

  /** İptal edilen taleplere verilmiş tekliflerin kredisi tam iade edilir (geri çekilmiş teklifler hariç) */
  async refundCancelledRequests(requestIds: string[]) {
    if (!requestIds.length) return 0;
    const quotes = await this.prisma.quote.findMany({
      where: { requestId: { in: requestIds }, creditCost: { gt: 0 }, creditRefundedAt: null, status: { not: QuoteStatus.WITHDRAWN } },
      select: { id: true, companyId: true, requestId: true, creditCost: true },
    });
    let refunded = 0;
    for (const q of quotes) {
      if (await this.refundQuote(q, q.creditCost, 'Talep iptal edildi')) refunded++;
    }
    return refunded;
  }

  /**
   * Hiçbir teklif seçilmeden süresi dolan talepler: ayardaki oran kadar iade. Oran 0 ise hiçbir şey yapılmaz.
   * Geriye dönük taranmaz, yalnızca son EXPIRED_REFUND_WINDOW_DAYS günde süresi dolanlar.
   */
  async refundExpired(now = new Date()) {
    const { settings } = await this.getSettings();
    if (settings.expiredRefundPercent <= 0) return 0;
    const quotes = await this.prisma.quote.findMany({
      where: {
        creditCost: { gt: 0 },
        creditRefundedAt: null,
        status: { in: [QuoteStatus.PENDING, QuoteStatus.EXPIRED] },
        request: {
          status: RequestStatus.OPEN,
          expiresAt: { lt: now, gte: new Date(now.getTime() - EXPIRED_REFUND_WINDOW_DAYS * DAY_MS) },
          booking: { is: null },
        },
      },
      select: { id: true, companyId: true, requestId: true, creditCost: true },
      take: 500,
    });
    let refunded = 0;
    for (const q of quotes) {
      const amount = expiredRefund(q.creditCost, settings.expiredRefundPercent);
      if (amount > 0 && (await this.refundQuote(q, amount, `Talep seçim yapılmadan kapandı (%${settings.expiredRefundPercent} iade)`))) refunded++;
    }
    return refunded;
  }

  /** Yönetimin elle eklemesi ya da düşmesi; gerekçe zorunlu, karar geçmişine yazılır */
  async adjust(adminId: string, companyId: string, amount: number, note: string) {
    const company = await this.prisma.company.findFirst({ where: { id: companyId, deletedAt: null }, select: { id: true } });
    if (!company) throw new NotFoundException('Firma bulunamadı');
    const entry = await this.prisma.$transaction(async (tx) => {
      const row = await this.post(tx, {
        companyId,
        type: amount > 0 ? CreditTransactionType.ADMIN_CREDIT : CreditTransactionType.ADMIN_DEBIT,
        amount,
        actorId: adminId,
        note,
      });
      await tx.auditLog.create({
        data: { actorId: adminId, action: 'credit.adjust', entityType: 'Company', entityId: companyId, details: { amount, note, transactionId: row.id, balanceAfter: row.balanceAfter } },
      });
      return row;
    });
    return { balance: entry.balanceAfter, transactionId: entry.id };
  }

  /** Firma ilk kez onaylanınca hoş geldin kredisi; firma başına bir kez (reddedilip yeniden onaylansa da) */
  async grantWelcome(companyId: string) {
    const { settings } = await this.getSettings();
    if (settings.welcomeCredits <= 0) return null;
    try {
      return await this.prisma.$transaction((tx) =>
        this.post(tx, { companyId, type: CreditTransactionType.WELCOME, amount: settings.welcomeCredits, idempotencyKey: `welcome:${companyId}` }),
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return null;
      throw e;
    }
  }

  /** Onaylanan havale; havale onay işleminin içinde çağrılır */
  topUpFromTransfer(tx: Tx, { companyId, transferId, credits, actorId, note }: { companyId: string; transferId: string; credits: number; actorId: string; note: string }) {
    return this.post(tx, { companyId, type: CreditTransactionType.TRANSFER_TOPUP, amount: credits, idempotencyKey: `transfer:${transferId}`, actorId, note });
  }

  /** Başarılı kart ödemesi; ödeme onay işleminin içinde çağrılır */
  topUpFromCard(tx: Tx, { companyId, paymentId, credits, note }: { companyId: string; paymentId: string; credits: number; note: string }) {
    return this.post(tx, { companyId, type: CreditTransactionType.CARD_TOPUP, amount: credits, idempotencyKey: `card:${paymentId}`, note });
  }

  // ─── İç ──────────────────────────────────────────────────────

  private refundQuote(q: { id: string; companyId: string; requestId: string }, amount: number, note: string) {
    return this.prisma.$transaction(async (tx) => {
      // Teklifi sahiplen: aynı anda çalışan iki iade aynı krediyi iki kez vermesin
      const claimed = await tx.quote.updateMany({ where: { id: q.id, creditRefundedAt: null }, data: { creditRefundedAt: new Date() } });
      if (claimed.count !== 1) return null;
      return this.post(tx, {
        companyId: q.companyId,
        type: CreditTransactionType.QUOTE_REFUND,
        amount,
        quoteId: q.id,
        requestId: q.requestId,
        idempotencyKey: `refund:${q.id}`,
        note,
      });
    });
  }

  private async post(tx: Tx, e: Entry) {
    if (!Number.isInteger(e.amount) || e.amount === 0) throw new Error(`Geçersiz kredi miktarı: ${e.amount}`);
    await tx.creditAccount.upsert({ where: { companyId: e.companyId }, create: { companyId: e.companyId }, update: {} });
    if (e.amount < 0) {
      // Koşullu düşüm: bakiye yetmiyorsa hiçbir satır değişmez
      const debited = await tx.creditAccount.updateMany({
        where: { companyId: e.companyId, balance: { gte: -e.amount } },
        data: { balance: { decrement: -e.amount } },
      });
      if (debited.count !== 1) throw new ConflictException(INSUFFICIENT_CREDIT);
    } else {
      await tx.creditAccount.update({ where: { companyId: e.companyId }, data: { balance: { increment: e.amount } } });
    }
    const { balance } = await tx.creditAccount.findUniqueOrThrow({ where: { companyId: e.companyId } });
    return tx.creditTransaction.create({ data: { ...e, balanceAfter: balance } });
  }
}
