import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getCityByCode } from '@nakliyat/locations';
import { CARD_MAX_TRY, creditsForAmount } from '../credits/credit-rules.js';
import { CreditsService } from '../credits/credits.service.js';
import { DomainEvents } from '../events/domain-events.js';
import { Prisma, type CardPayment } from '../generated/prisma/client.js';
import { CardPaymentStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { IyzicoClient, IyzicoError, type CheckoutResult } from './iyzico.client.js';

/** Form açıldıktan bu kadar sonra sonuç gelmediyse ödeme bitmemiş sayılır (iyzico formu 30 dk geçerli) */
export const CARD_PAYMENT_TIMEOUT_MS = 35 * 60_000;
/** Bekleyen ödeme en fazla bu kadar süre yeniden sorgulanır (iyzico incelemesi sürebilir) */
const RECHECK_LIMIT_MS = 24 * 60 * 60_000;

const ADMIN_INCLUDE = {
  company: { select: { id: true, displayName: true } },
  user: { select: { id: true, fullName: true } },
} satisfies Prisma.CardPaymentInclude;

/** "+905321234567" biçimi (iyzico gsmNumber) */
const gsm = (phone: string) => (phone.startsWith('+') ? phone : `+${phone}`);

/**
 * Kartla kredi yükleme (iyzico Checkout Form).
 * 1. start: ödeme kaydı açılır (tutar ve kredi o anki kredi değeriyle sabitlenir), iyzico ödeme sayfası istenir.
 * 2. Firma iyzico sayfasında 3D Secure ile öder; iyzico tarayıcıyı dönüş adresimize gönderir (token ile).
 * 3. complete: sonuç iyzico'ya sunucudan sorulur, tutar ve sepet kimliği karşılaştırılır, kredi bir kez yüklenir.
 * Dönüş hiç gelmezse (sekme kapandı) reconcile, bekleyen ödemeleri sonradan sorgular.
 */
@Injectable()
export class CardPaymentsService {
  private readonly logger = new Logger(CardPaymentsService.name);
  private readonly apiUrl: string;
  readonly webUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly iyzico: IyzicoClient,
    private readonly events: DomainEvents,
    config: ConfigService,
  ) {
    const production = config.get('NODE_ENV') === 'production';
    this.apiUrl = (config.get<string>('API_PUBLIC_URL') ?? (production ? 'https://api.evdenevenakliyat.app' : `http://localhost:${config.get('PORT') ?? 4000}`)).replace(/\/$/, '');
    this.webUrl = (config.get<string>('WEB_URL') ?? 'https://evdenevenakliyat.app').replace(/\/$/, '');
  }

  /** Firma panelinde kart seçeneği: ayar açık ve anahtarlar tanımlıysa */
  async availability() {
    const { settings } = await this.credits.getSettings();
    if (!settings.cardEnabled || !this.iyzico.configured) return null;
    return { minTry: settings.minTopupTry, maxTry: CARD_MAX_TRY, sandbox: this.iyzico.sandbox };
  }

  /** Yönetim ayar ekranı: anahtarlar tanımlı mı, deneme ortamı mı */
  status() {
    return { configured: this.iyzico.configured, sandbox: this.iyzico.sandbox };
  }

  async start(user: { id: string; impersonatorId?: string }, companyId: string, amountTry: number, ip: string) {
    if (user.impersonatorId) throw new ForbiddenException('Yönetici görünümünde kartla ödeme yapılamaz');
    const { settings } = await this.credits.getSettings();
    if (!settings.cardEnabled || !this.iyzico.configured) throw new BadRequestException('Kartla ödeme şu an kapalı');
    if (amountTry < settings.minTopupTry) throw new BadRequestException(`En az ${settings.minTopupTry.toLocaleString('tr-TR')} TL yükleyebilirsiniz`);
    if (amountTry > CARD_MAX_TRY) throw new BadRequestException(`Kartla tek seferde en fazla ${CARD_MAX_TRY.toLocaleString('tr-TR')} TL yükleyebilirsiniz`);
    const credits = creditsForAmount(amountTry, settings.creditValueTry);
    if (credits < 1) throw new BadRequestException('Tutar en az 1 kredi etmeli');

    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { id: true, cityCode: true, owner: { select: { id: true, fullName: true, phone: true, email: true } } },
    });
    if (!company) throw new NotFoundException('Firma bulunamadı');
    const { owner } = company;
    if (!owner.email) throw new BadRequestException('Kartla ödeme için hesabına e-posta adresi eklemelisin (Ayarlar).');

    const price = amountTry.toFixed(2);
    const payment = await this.prisma.cardPayment.create({
      data: {
        companyId,
        userId: user.id,
        amountTry: new Prisma.Decimal(price),
        credits,
        creditValueTry: new Prisma.Decimal(settings.creditValueTry.toFixed(2)),
        sandbox: this.iyzico.sandbox,
      },
    });

    const [name, ...rest] = owner.fullName.trim().split(/\s+/);
    const city = getCityByCode(company.cityCode)?.name ?? 'İstanbul';
    try {
      const form = await this.iyzico.initializeCheckout({
        paymentId: payment.id,
        price,
        itemName: `${credits.toLocaleString('tr-TR')} kredi`,
        callbackUrl: `${this.apiUrl}/v1/payments/iyzico/callback`,
        buyer: {
          id: company.id,
          name: name || owner.fullName,
          surname: rest.join(' ') || name || owner.fullName,
          email: owner.email,
          gsmNumber: gsm(owner.phone),
          city,
          address: `${city}, Türkiye`,
          ip,
        },
      });
      await this.prisma.cardPayment.update({ where: { id: payment.id }, data: { token: form.token } });
      return { id: payment.id, paymentPageUrl: form.paymentPageUrl, credits, amountTry: price };
    } catch (e) {
      const message = e instanceof IyzicoError ? e.message : 'Ödeme formu açılamadı';
      await this.prisma.cardPayment.update({ where: { id: payment.id }, data: { status: CardPaymentStatus.FAILED, errorMessage: message.slice(0, 500), completedAt: new Date() } });
      if (!(e instanceof IyzicoError)) throw e;
      this.logger.warn(`iyzico ödeme formu açılamadı: ${e.code ?? ''} ${e.message}`);
      throw new ServiceUnavailableException(`Ödeme formu açılamadı: ${e.message}. Biraz sonra tekrar dene.`);
    }
  }

  /**
   * iyzico dönüşü (ve bekleyenlerin yeniden sorgusu). Sonuç her zaman iyzico'ya sorulur.
   * Ödeme kaydını döner; token bilinmiyorsa null.
   */
  async complete(token: string): Promise<CardPayment | null> {
    const payment = await this.prisma.cardPayment.findUnique({ where: { token } });
    if (!payment) return null;
    if (payment.status !== CardPaymentStatus.PENDING) return payment;

    let result: CheckoutResult;
    try {
      result = await this.iyzico.retrieveCheckout(token, payment.id);
    } catch (e) {
      // Sağlayıcıya ulaşılamadı: bekleyen kalır, reconcile tekrar dener
      this.logger.warn(`iyzico sonucu sorgulanamadı (${payment.id}): ${(e as Error).message}`);
      return payment;
    }
    const verdict = this.judge(payment, result);
    if (verdict === 'pending') {
      if (Date.now() - payment.createdAt.getTime() > CARD_PAYMENT_TIMEOUT_MS && result.paymentStatus !== 'SUCCESS') {
        return this.fail(payment, CardPaymentStatus.EXPIRED, 'Ödeme tamamlanmadı');
      }
      return payment;
    }
    if (verdict !== 'success') return this.fail(payment, CardPaymentStatus.FAILED, verdict.error);
    return this.succeed(payment, result.paymentId ?? null);
  }

  /** Dönüşü gelmemiş bekleyen ödemeler: sonuç sorulur, süresi geçmişse bitmemiş sayılır */
  async reconcile(now = new Date()) {
    const pending = await this.prisma.cardPayment.findMany({
      where: { status: CardPaymentStatus.PENDING, createdAt: { lt: new Date(now.getTime() - 5 * 60_000) } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    let changed = 0;
    for (const p of pending) {
      const tooOld = now.getTime() - p.createdAt.getTime() > RECHECK_LIMIT_MS;
      const done = !p.token || tooOld ? await this.fail(p, CardPaymentStatus.EXPIRED, 'Ödeme tamamlanmadı') : await this.complete(p.token);
      if (done && done.status !== CardPaymentStatus.PENDING) changed++;
    }
    return changed;
  }

  async getOwn(companyId: string, id: string) {
    const payment = await this.prisma.cardPayment.findFirst({ where: { id, companyId } });
    if (!payment) throw new NotFoundException('Ödeme bulunamadı');
    return this.toView(payment);
  }

  async listForAdmin({ status, q, page, limit }: { status?: CardPaymentStatus; q?: string; page: number; limit: number }) {
    const where: Prisma.CardPaymentWhereInput = {
      ...(status && { status }),
      ...(q && { company: { displayName: { contains: q } } }),
    };
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [rows, total, last30] = await this.prisma.$transaction([
      this.prisma.cardPayment.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit, include: ADMIN_INCLUDE }),
      this.prisma.cardPayment.count({ where }),
      this.prisma.cardPayment.aggregate({
        where: { status: CardPaymentStatus.SUCCESS, sandbox: false, completedAt: { gte: since } },
        _sum: { amountTry: true, credits: true },
        _count: { _all: true },
      }),
    ]);
    return {
      items: rows.map(({ company, user, ...p }) => ({ ...this.toView(p as CardPayment), company, user })),
      total,
      page,
      limit,
      last30Days: { count: last30._count._all, amountTry: (last30._sum.amountTry ?? new Prisma.Decimal(0)).toFixed(2), credits: last30._sum.credits ?? 0 },
      ...this.status(),
    };
  }

  toView(p: CardPayment) {
    return {
      id: p.id,
      status: p.status,
      amountTry: p.amountTry.toFixed(2),
      credits: p.credits,
      sandbox: p.sandbox,
      providerPaymentId: p.providerPaymentId,
      errorMessage: p.errorMessage,
      createdAt: p.createdAt,
      completedAt: p.completedAt,
    };
  }

  // ─── İç ──────────────────────────────────────────────────────

  /** iyzico yanıtı bu ödemeyle uyuşuyor mu */
  private judge(payment: CardPayment, r: CheckoutResult): 'success' | 'pending' | { error: string } {
    if (r.status !== 'success') {
      // Form doldurulmadan sorgulanınca da hata döner; süre dolana kadar beklenir
      return r.paymentStatus === 'FAILURE' ? { error: r.errorMessage || 'Ödeme alınamadı' } : 'pending';
    }
    if (r.paymentStatus === 'FAILURE') return { error: r.errorMessage || 'Ödeme alınamadı' };
    if (r.paymentStatus !== 'SUCCESS') return 'pending';
    if (r.basketId !== payment.id || (r.currency && r.currency !== 'TRY')) return { error: 'Ödeme bilgisi bu kayıtla uyuşmuyor' };
    const paid = Math.round(Number(r.paidPrice ?? r.price) * 100);
    if (paid !== Math.round(Number(payment.amountTry) * 100)) return { error: 'Ödenen tutar uyuşmuyor' };
    if (r.fraudStatus === -1) return { error: 'Ödeme güvenlik kontrolünden geçmedi' };
    if (r.fraudStatus === 0) return 'pending';
    return 'success';
  }

  private async succeed(payment: CardPayment, providerPaymentId: string | null) {
    const done = await this.prisma.$transaction(async (tx) => {
      // Ödemeyi sahiplen: dönüş ve yeniden sorgu aynı anda gelse de kredi bir kez yüklenir
      const claimed = await tx.cardPayment.updateMany({
        where: { id: payment.id, status: CardPaymentStatus.PENDING },
        data: { status: CardPaymentStatus.SUCCESS, providerPaymentId, completedAt: new Date() },
      });
      if (claimed.count !== 1) return false;
      const amount = Number(payment.amountTry).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const row = await this.credits.topUpFromCard(tx, {
        companyId: payment.companyId,
        paymentId: payment.id,
        credits: payment.credits,
        note: `Kartla ödeme ${amount} TL${payment.sandbox ? ' (deneme)' : ''}`,
      });
      await tx.cardPayment.update({ where: { id: payment.id }, data: { transactionId: row.id } });
      return true;
    });
    if (done) this.events.emit('credit.card_paid', { paymentId: payment.id });
    return this.prisma.cardPayment.findUniqueOrThrow({ where: { id: payment.id } });
  }

  private async fail(payment: CardPayment, status: CardPaymentStatus, message: string) {
    await this.prisma.cardPayment.updateMany({
      where: { id: payment.id, status: CardPaymentStatus.PENDING },
      data: { status, errorMessage: message.slice(0, 500), completedAt: new Date() },
    });
    return this.prisma.cardPayment.findUniqueOrThrow({ where: { id: payment.id } });
  }
}
