import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompaniesService } from '../companies/companies.service.js';
import type { CompanyDocument, Prisma } from '../generated/prisma/client.js';
import { CompanyDocumentType, VerificationStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DATED_DOCUMENT_TYPES,
  DOCUMENT_LABELS,
  DOCUMENT_RULES,
  isExpired,
  MAX_OTHER_DOCUMENTS,
  REQUIRED_DOCUMENT_TYPES,
  requirementState,
  todayInTurkey,
} from './company-document-rules.js';
import type { AttachDocumentDto, CreateDocumentUploadDto } from './dto/company-documents.dto.js';
import { EXTENSIONS } from './media-rules.js';
import { MediaService } from './media.service.js';
import { FILE_STORAGE, type MediaStorage } from './storage.js';

/**
 * Firma doğrulama belgeleri (K3, vergi levhası, ticaret sicil...). Akış talep medyasıyla aynı:
 * 1. createUpload: firma dosya türü ve boyutunu bildirir, kısa süreli yükleme adresi alır.
 * 2. Tarayıcı dosyayı API'ye yükler; R2'ye, olmazsa sunucu diskine kaydedilir (MediaStorage).
 * 3. attach: dosya depoda doğrulanır, belge türü ve geçerlilik tarihiyle kaydedilir; yönetici inceler.
 *
 * Her türden bir güncel belge tutulur ("Diğer" hariç): yeni yüklenen belge, onaylanmamış eskisinin yerini
 * hemen alır; onaylı eskisi ise yenisi onaylanana kadar kalır (K3 yenilemesinde firma doğrulamasız kalmasın).
 */
@Injectable()
export class CompanyDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly media: MediaService,
    @Inject(FILE_STORAGE) private readonly storage: MediaStorage,
  ) {}

  async listOwn(ownerId: string) {
    const company = await this.companies.requireCompany(ownerId);
    return this.summary(company.id);
  }

  async createUpload(ownerId: string, { mimeType, sizeBytes }: CreateDocumentUploadDto) {
    const company = await this.companies.requireCompany(ownerId);
    if (sizeBytes > DOCUMENT_RULES.maxBytes) {
      throw new BadRequestException('Belge en fazla 10 MB olabilir. PDF ise sıkıştırın ya da fotoğrafını çekip yükleyin.');
    }
    await this.media.checkQuota(sizeBytes, 'Belge yükleme şu an kullanılamıyor, lütfen daha sonra tekrar dene.');
    const key = `firmalar/${company.id}/${randomBytes(16).toString('hex')}.${EXTENSIONS[mimeType]}`;
    return { key, ...this.storage.createUpload(key, mimeType, sizeBytes) };
  }

  async attach(ownerId: string, dto: AttachDocumentDto) {
    const company = await this.companies.requireCompany(ownerId);
    if (!dto.key.startsWith(`firmalar/${company.id}/`)) throw new BadRequestException('Dosya bu firmaya ait değil');
    // Aynı istek iki kez gelirse (ör. bağlantı koptu, tekrar denendi) ikinci kayıt açılmaz
    if (await this.prisma.companyDocument.findUnique({ where: { storageKey: dto.key } })) {
      return this.summary(company.id);
    }

    const validUntil = this.parseValidUntil(dto);
    if (dto.type === CompanyDocumentType.OTHER) {
      const others = await this.prisma.companyDocument.count({
        where: { companyId: company.id, type: CompanyDocumentType.OTHER },
      });
      if (others >= MAX_OTHER_DOCUMENTS) {
        throw new BadRequestException(`En fazla ${MAX_OTHER_DOCUMENTS} ek belge yüklenebilir, önce birini silin`);
      }
    }

    const object = await this.storage.stat(dto.key);
    if (!object) throw new BadRequestException('Dosya yüklenmemiş ya da yükleme yarıda kalmış, tekrar deneyin');
    if (!(DOCUMENT_RULES.mimeTypes as readonly string[]).includes(object.mimeType) || object.sizeBytes > DOCUMENT_RULES.maxBytes) {
      await this.media.deleteObjects([{ storageKey: dto.key, storage: object.location }]);
      throw new BadRequestException('Dosya türü veya boyutu uygun değil');
    }

    // Aynı türün onaylanmamış eski belgeleri yenisiyle değişir
    const replaced =
      dto.type === CompanyDocumentType.OTHER
        ? []
        : await this.prisma.companyDocument.findMany({
            where: { companyId: company.id, type: dto.type, status: { not: VerificationStatus.VERIFIED } },
          });

    await this.prisma.$transaction([
      this.prisma.companyDocument.create({
        data: {
          companyId: company.id,
          type: dto.type,
          storageKey: dto.key,
          storage: object.location,
          mimeType: object.mimeType,
          sizeBytes: object.sizeBytes,
          fileName: dto.fileName,
          validUntil,
        },
      }),
      this.prisma.companyDocument.deleteMany({ where: { id: { in: replaced.map((d) => d.id) } } }),
      // Firma inceleme ekranının karar geçmişinde görünür
      this.prisma.auditLog.create({
        data: {
          actorId: ownerId,
          action: 'company.document.upload',
          entityType: 'Company',
          entityId: company.id,
          details: { type: dto.type, fileName: dto.fileName },
        },
      }),
      // Reddedilmiş firma yeni belge yüklediğinde yeniden incelemeye girer
      ...(company.verificationStatus === VerificationStatus.REJECTED
        ? [
            this.prisma.company.update({
              where: { id: company.id },
              data: { verificationStatus: VerificationStatus.PENDING },
            }),
          ]
        : []),
    ]);
    await this.media.deleteObjects(replaced);
    return this.summary(company.id);
  }

  async remove(ownerId: string, documentId: string) {
    const company = await this.companies.requireCompany(ownerId);
    const document = await this.prisma.companyDocument.findFirst({ where: { id: documentId, companyId: company.id } });
    if (!document) throw new NotFoundException('Belge bulunamadı');
    if (document.status === VerificationStatus.VERIFIED) {
      throw new ConflictException('Onaylanmış belge silinemez. Yenisini yükleyin; onaylanınca eskisinin yerini alır.');
    }
    await this.prisma.companyDocument.delete({ where: { id: document.id } });
    await this.media.deleteObjects([document]);
  }

  /** Belgeler (görüntüleme adresleriyle) ve zorunlu belgelerin durumu */
  async summary(companyId: string) {
    const documents = await this.prisma.companyDocument.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    return {
      documents: documents.map((d) => this.toView(d)),
      requirements: REQUIRED_DOCUMENT_TYPES.map((type) => ({ type, state: requirementState(documents, type) })),
    };
  }

  /**
   * Yönetimdeki belge listesi (varsayılan: onay bekleyenler, en eski önce). Onaylı firmanın yüklediği
   * güncelleme de burada görünür; aynı türden onaylı eski belgesi olanlar `replacesVerified` ile işaretlenir.
   */
  async listForAdmin({ status, q, page, limit }: { status?: VerificationStatus; q?: string; page: number; limit: number }) {
    const where: Prisma.CompanyDocumentWhereInput = {
      company: {
        deletedAt: null,
        ...(q && { OR: [{ displayName: { contains: q } }, { legalName: { contains: q } }, { taxNumber: { contains: q } }] }),
      },
      ...(status && { status }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.companyDocument.findMany({
        where,
        orderBy: { createdAt: status === VerificationStatus.PENDING ? 'asc' : 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { company: { select: { id: true, displayName: true, legalName: true, verificationStatus: true } } },
      }),
      this.prisma.companyDocument.count({ where }),
    ]);
    const verified = rows.length
      ? await this.prisma.companyDocument.findMany({
          where: {
            status: VerificationStatus.VERIFIED,
            OR: rows.map((d) => ({ companyId: d.companyId, type: d.type, id: { not: d.id } })),
          },
          select: { companyId: true, type: true },
        })
      : [];
    return {
      items: rows.map(({ company, ...d }) => ({
        ...this.toView(d),
        company,
        replacesVerified:
          d.type !== CompanyDocumentType.OTHER &&
          verified.some((v) => v.companyId === d.companyId && v.type === d.type),
      })),
      total,
      page,
      limit,
    };
  }

  /** Firma onayını engelleyen eksikler: onaylı ve süresi geçerli belgesi olmayan zorunlu türler */
  async missingForVerification(companyId: string) {
    const documents = await this.prisma.companyDocument.findMany({ where: { companyId } });
    return REQUIRED_DOCUMENT_TYPES.filter((type) => requirementState(documents, type) !== 'VERIFIED').map(
      (type) => DOCUMENT_LABELS[type],
    );
  }

  /** Yönetici kararı. Onaylanan belge, aynı türün daha eski belgelerinin yerini alır. */
  async review(adminId: string, companyId: string, documentId: string, status: VerificationStatus, note?: string) {
    const document = await this.prisma.companyDocument.findFirst({
      where: { id: documentId, companyId, company: { deletedAt: null } },
    });
    if (!document) throw new NotFoundException('Belge bulunamadı');
    const approved = status === VerificationStatus.VERIFIED;
    const older =
      approved && document.type !== CompanyDocumentType.OTHER
        ? await this.prisma.companyDocument.findMany({
            where: { companyId, type: document.type, id: { not: document.id }, createdAt: { lte: document.createdAt } },
          })
        : [];

    await this.prisma.$transaction([
      this.prisma.companyDocument.update({
        where: { id: document.id },
        data: { status, reviewNote: note ?? null, reviewedAt: new Date() },
      }),
      this.prisma.companyDocument.deleteMany({ where: { id: { in: older.map((d) => d.id) } } }),
      this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: approved ? 'company.document.approve' : 'company.document.reject',
          entityType: 'Company',
          entityId: companyId,
          details: { documentId: document.id, type: document.type, note: note ?? null },
        },
      }),
    ]);
    await this.media.deleteObjects(older);
    return this.summary(companyId);
  }

  /** Hesap silinirken firmanın belgeleri kalıcı olarak silinir (KVKK) */
  async deleteForCompany(companyId: string) {
    const documents = await this.prisma.companyDocument.findMany({
      where: { companyId },
      select: { storageKey: true, storage: true },
    });
    if (!documents.length) return;
    await this.prisma.companyDocument.deleteMany({ where: { companyId } });
    await this.media.deleteObjects(documents);
  }

  toView(document: CompanyDocument) {
    return {
      id: document.id,
      type: document.type,
      status: document.status,
      fileName: document.fileName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      validUntil: document.validUntil?.toISOString().slice(0, 10) ?? null,
      expired: isExpired(document.validUntil),
      reviewNote: document.reviewNote,
      createdAt: document.createdAt,
      reviewedAt: document.reviewedAt,
      url: this.storage.viewUrl(document.storageKey, document.storage),
    };
  }

  private parseValidUntil({ type, validUntil }: AttachDocumentDto) {
    if (!validUntil) {
      if (DATED_DOCUMENT_TYPES.includes(type)) {
        throw new BadRequestException(`${DOCUMENT_LABELS[type]} için geçerlilik bitiş tarihini girin`);
      }
      return null;
    }
    const date = new Date(`${validUntil}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== validUntil) {
      throw new BadRequestException('Geçerlilik tarihi geçersiz');
    }
    if (validUntil < todayInTurkey()) throw new BadRequestException('Süresi dolmuş belge yüklenemez');
    return date;
  }
}
