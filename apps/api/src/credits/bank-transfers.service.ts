import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DomainEvents } from '../events/domain-events.js';
import { Prisma, type BankTransfer } from '../generated/prisma/client.js';
import { BankTransferStatus } from '../generated/prisma/enums.js';
import { DOCUMENT_RULES, todayInTurkey } from '../media/company-document-rules.js';
import { CompanyDocumentsService } from '../media/company-documents.service.js';
import { MediaService } from '../media/media.service.js';
import { FILE_STORAGE, type MediaStorage } from '../media/storage.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { creditsForAmount, formatIban } from './credit-rules.js';
import { CreditsService } from './credits.service.js';
import type { CreateBankTransferDto } from './dto/credit.dto.js';

/** Firmanın aynı anda bekleyebilecek en fazla bildirimi */
export const MAX_PENDING_TRANSFERS = 5;
/** Bu kadar günden eski havale bildirilemez */
export const TRANSFER_MAX_AGE_DAYS = 30;

const DAY_MS = 86_400_000;

const ADMIN_INCLUDE = {
  company: { select: { id: true, displayName: true, legalName: true, creditAccount: { select: { transferCode: true, balance: true } } } },
  reviewedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.BankTransferInclude;

type AdminRow = Prisma.BankTransferGetPayload<{ include: typeof ADMIN_INCLUDE }>;

/**
 * Havale/EFT ile kredi yükleme. Firma ödemeyi yapıp bildirir (isteğe bağlı dekontla); yönetim hesaba geçen
 * tutarı görünce onaylar ve kredi o anda, onay anındaki kredi değeriyle yüklenir. Reddedilen bildirimde kredi yüklenmez.
 */
@Injectable()
export class BankTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly documents: CompanyDocumentsService,
    private readonly media: MediaService,
    private readonly events: DomainEvents,
    @Inject(FILE_STORAGE) private readonly storage: MediaStorage,
  ) {}

  /** Dekont yükleme adresi: belge yüklemesiyle aynı kurallar (PDF/JPG/PNG/WebP, 10 MB) */
  createReceiptUpload(ownerId: string, dto: { mimeType: string; sizeBytes: number }) {
    return this.documents.createUpload(ownerId, dto);
  }

  async create(companyId: string, ownerId: string, dto: CreateBankTransferDto) {
    const { settings } = await this.credits.getSettings();
    if (!settings.bankAccounts.length) throw new BadRequestException('Havale ile kredi yükleme şu an kapalı');
    if (!settings.bankAccounts.some((a) => a.iban === dto.iban)) throw new BadRequestException('Gönderdiğiniz hesabı listeden seçin');
    if (dto.amountTry < settings.minTopupTry) {
      throw new BadRequestException(`En az ${settings.minTopupTry.toLocaleString('tr-TR')} TL yükleyebilirsiniz`);
    }
    if (creditsForAmount(dto.amountTry, settings.creditValueTry) < 1) throw new BadRequestException('Tutar en az 1 kredi etmeli');

    const today = todayInTurkey();
    const oldest = todayInTurkey(new Date(Date.now() - TRANSFER_MAX_AGE_DAYS * DAY_MS));
    if (Number.isNaN(Date.parse(dto.transferDate)) || dto.transferDate > today) throw new BadRequestException('Havale tarihi bugünden sonra olamaz');
    if (dto.transferDate < oldest) {
      throw new BadRequestException(`${TRANSFER_MAX_AGE_DAYS} günden eski havaleler için destek adresine yazın`);
    }

    const pending = await this.prisma.bankTransfer.count({ where: { companyId, status: BankTransferStatus.PENDING } });
    if (pending >= MAX_PENDING_TRANSFERS) {
      throw new ConflictException(`Onay bekleyen ${MAX_PENDING_TRANSFERS} bildiriminiz var. Onaylandıktan sonra yenisini ekleyin.`);
    }

    const receipt = dto.receipt ? await this.verifyReceipt(companyId, dto.receipt.key) : null;
    const transfer = await this.prisma.bankTransfer.create({
      data: {
        companyId,
        amountTry: new Prisma.Decimal(dto.amountTry.toFixed(2)),
        senderName: dto.senderName,
        transferDate: new Date(`${dto.transferDate}T00:00:00Z`),
        iban: dto.iban,
        note: dto.note || null,
        ...(receipt && dto.receipt && {
          receiptKey: dto.receipt.key,
          receiptStorage: receipt.location,
          receiptMimeType: receipt.mimeType,
          receiptSizeBytes: receipt.sizeBytes,
          receiptFileName: dto.receipt.fileName,
        }),
      },
    });
    await this.prisma.auditLog.create({
      data: { actorId: ownerId, action: 'transfer.create', entityType: 'BankTransfer', entityId: transfer.id, details: { amountTry: dto.amountTry } },
    });
    return this.toView(transfer);
  }

  async listOwn(companyId: string, page: number, limit: number) {
    const where = { companyId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.bankTransfer.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.bankTransfer.count({ where }),
    ]);
    return { items: rows.map((t) => this.toView(t)), total, page, limit };
  }

  /** Firma, onaylanmamış bildirimini geri alır (ör. yanlış tutar yazdı) */
  async cancel(companyId: string, ownerId: string, id: string) {
    const claimed = await this.prisma.bankTransfer.updateMany({
      where: { id, companyId, status: BankTransferStatus.PENDING },
      data: { status: BankTransferStatus.CANCELLED },
    });
    if (claimed.count !== 1) {
      const exists = await this.prisma.bankTransfer.findFirst({ where: { id, companyId }, select: { id: true } });
      if (!exists) throw new NotFoundException('Bildirim bulunamadı');
      throw new ConflictException('Bu bildirim incelendiği için geri alınamaz');
    }
    await this.prisma.auditLog.create({ data: { actorId: ownerId, action: 'transfer.cancel', entityType: 'BankTransfer', entityId: id } });
    return this.toView(await this.prisma.bankTransfer.findUniqueOrThrow({ where: { id } }));
  }

  // ─── Yönetim ─────────────────────────────────────────────────

  async listForAdmin({ status, q, page, limit }: { status?: BankTransferStatus; q?: string; page: number; limit: number }) {
    const where: Prisma.BankTransferWhereInput = {
      ...(status && { status }),
      ...(q && {
        OR: [
          { company: { displayName: { contains: q } } },
          { company: { legalName: { contains: q } } },
          { company: { creditAccount: { transferCode: { contains: q.toUpperCase() } } } },
          { senderName: { contains: q } },
        ],
      }),
    };
    const [{ settings }, rows, total, pending] = await Promise.all([
      this.credits.getSettings(),
      this.prisma.bankTransfer.findMany({
        where,
        // Bekleyenler en eski önce (sırayla işlenir), diğerleri en yeni önce
        orderBy: [{ createdAt: status === BankTransferStatus.PENDING ? 'asc' : 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: ADMIN_INCLUDE,
      }),
      this.prisma.bankTransfer.count({ where }),
      this.prisma.bankTransfer.count({ where: { status: BankTransferStatus.PENDING } }),
    ]);
    return {
      items: rows.map((t) => this.toAdminView(t, settings.creditValueTry)),
      total,
      page,
      limit,
      pending,
      creditValueTry: settings.creditValueTry,
    };
  }

  /** Onay: hesaba geçen tutar (verilmezse bildirilen) onay anındaki kredi değerine bölünür, kredi aynı işlemde yüklenir */
  async approve(adminId: string, id: string, amountTry?: number) {
    const transfer = await this.prisma.bankTransfer.findUnique({ where: { id }, include: { company: { select: { deletedAt: true } } } });
    if (!transfer) throw new NotFoundException('Bildirim bulunamadı');
    if (transfer.status !== BankTransferStatus.PENDING) throw new ConflictException('Bu bildirim zaten incelendi');
    if (transfer.company.deletedAt) throw new ConflictException('Firma silinmiş; kredi yüklenemez');

    const { settings } = await this.credits.getSettings();
    const amount = amountTry ?? Number(transfer.amountTry);
    const credits = creditsForAmount(amount, settings.creditValueTry);
    if (credits < 1) throw new BadRequestException('Tutar en az 1 kredi etmeli');

    await this.prisma.$transaction(async (tx) => {
      // Bildirimi sahiplen: iki yönetici aynı anda onaylarsa kredi bir kez yüklensin
      const claimed = await tx.bankTransfer.updateMany({
        where: { id, status: BankTransferStatus.PENDING },
        data: {
          status: BankTransferStatus.APPROVED,
          approvedAmountTry: new Prisma.Decimal(amount.toFixed(2)),
          credits,
          creditValueTry: new Prisma.Decimal(settings.creditValueTry.toFixed(2)),
          reviewedById: adminId,
          reviewedAt: new Date(),
        },
      });
      if (claimed.count !== 1) throw new ConflictException('Bu bildirim zaten incelendi');
      const row = await this.credits.topUpFromTransfer(tx, {
        companyId: transfer.companyId,
        transferId: id,
        credits,
        actorId: adminId,
        note: `Havale/EFT ${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`,
      });
      await tx.bankTransfer.update({ where: { id }, data: { transactionId: row.id } });
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'transfer.approve',
          entityType: 'Company',
          entityId: transfer.companyId,
          details: { transferId: id, reportedTry: Number(transfer.amountTry), amountTry: amount, credits, balanceAfter: row.balanceAfter },
        },
      });
    });
    this.events.emit('credit.transfer_reviewed', { transferId: id });
    return this.adminView(id);
  }

  async reject(adminId: string, id: string, reason: string) {
    const transfer = await this.prisma.bankTransfer.findUnique({ where: { id }, select: { companyId: true, amountTry: true } });
    if (!transfer) throw new NotFoundException('Bildirim bulunamadı');
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.bankTransfer.updateMany({
        where: { id, status: BankTransferStatus.PENDING },
        data: { status: BankTransferStatus.REJECTED, rejectReason: reason, reviewedById: adminId, reviewedAt: new Date() },
      });
      if (claimed.count !== 1) throw new ConflictException('Bu bildirim zaten incelendi');
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'transfer.reject',
          entityType: 'Company',
          entityId: transfer.companyId,
          details: { transferId: id, amountTry: Number(transfer.amountTry), reason },
        },
      });
    });
    this.events.emit('credit.transfer_reviewed', { transferId: id });
    return this.adminView(id);
  }

  pendingCount() {
    return this.prisma.bankTransfer.count({ where: { status: BankTransferStatus.PENDING } });
  }

  // ─── İç ──────────────────────────────────────────────────────

  private async adminView(id: string) {
    const [{ settings }, row] = await Promise.all([
      this.credits.getSettings(),
      this.prisma.bankTransfer.findUniqueOrThrow({ where: { id }, include: ADMIN_INCLUDE }),
    ]);
    return this.toAdminView(row, settings.creditValueTry);
  }

  /** Dekont bu firmanın yüklediği, depoda duran, kurallara uyan bir dosya mı */
  private async verifyReceipt(companyId: string, key: string) {
    if (!key.startsWith(`firmalar/${companyId}/`)) throw new BadRequestException('Dosya bu firmaya ait değil');
    const used =
      (await this.prisma.bankTransfer.findUnique({ where: { receiptKey: key }, select: { id: true } })) ??
      (await this.prisma.companyDocument.findUnique({ where: { storageKey: key }, select: { id: true } }));
    if (used) throw new ConflictException('Bu dekont zaten kullanıldı, yeniden yükleyin');
    const object = await this.storage.stat(key);
    if (!object) throw new BadRequestException('Dekont yüklenmemiş ya da yükleme yarıda kalmış, tekrar deneyin');
    if (!(DOCUMENT_RULES.mimeTypes as readonly string[]).includes(object.mimeType) || object.sizeBytes > DOCUMENT_RULES.maxBytes) {
      await this.media.deleteObjects([{ storageKey: key, storage: object.location }]);
      throw new BadRequestException('Dekont türü veya boyutu uygun değil');
    }
    return object;
  }

  private toView(t: BankTransfer) {
    return {
      id: t.id,
      status: t.status,
      amountTry: t.amountTry.toFixed(2),
      approvedAmountTry: t.approvedAmountTry?.toFixed(2) ?? null,
      credits: t.credits,
      senderName: t.senderName,
      transferDate: t.transferDate.toISOString().slice(0, 10),
      iban: formatIban(t.iban),
      note: t.note,
      rejectReason: t.rejectReason,
      receipt:
        t.receiptKey && t.receiptStorage
          ? {
              fileName: t.receiptFileName ?? 'dekont',
              mimeType: t.receiptMimeType,
              sizeBytes: t.receiptSizeBytes,
              url: this.storage.viewUrl(t.receiptKey, t.receiptStorage),
            }
          : null,
      createdAt: t.createdAt,
      reviewedAt: t.reviewedAt,
    };
  }

  private toAdminView({ company, reviewedBy, ...t }: AdminRow, creditValueTry: number) {
    return {
      ...this.toView(t as BankTransfer),
      company: { id: company.id, displayName: company.displayName, legalName: company.legalName, balance: company.creditAccount?.balance ?? 0 },
      transferCode: company.creditAccount?.transferCode ?? null,
      reviewedBy,
      /** Bekleyen bildirimde: bildirilen tutar bugünkü kredi değeriyle kaç kredi eder */
      expectedCredits: t.status === BankTransferStatus.PENDING ? creditsForAmount(Number(t.amountTry), creditValueTry) : null,
    };
  }
}
