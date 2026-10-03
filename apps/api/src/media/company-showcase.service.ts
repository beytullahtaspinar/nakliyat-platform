import { randomBytes } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CompaniesService, PUBLIC_COMPANY } from '../companies/companies.service.js';
import {
  assertNoContactInfo,
  INDEX_RULES,
  isShowcaseComplete,
  SERVICE_CODES,
  servicesOf,
  SHOWCASE_RULES,
} from '../companies/showcase-rules.js';
import type { Company, CompanyMedia, Prisma } from '../generated/prisma/client.js';
import { CompanyMediaKind } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AttachShowcaseMediaDto,
  CreateShowcaseUploadDto,
  UpdateShowcaseDto,
} from './dto/company-showcase.dto.js';
import { EXTENSIONS, publicMediaPath } from './media-rules.js';
import { MediaService, type StoredFile } from './media.service.js';
import { FILE_STORAGE, type MediaStorage } from './storage.js';

/**
 * Firma tanıtım sayfası: tanıtım yazısı, hizmetler, kuruluş yılı, araç/ekip sayısı, logo ve fotoğraflar.
 * Görseller talep medyası gibi tarayıcıda küçültülür (fotoğraf: 1600 px + 480 px önizleme, logo: 192 px WebP)
 * ve aynı depoya (R2, olmazsa sunucu diski) yüklenir. Yönetici onayı beklemeden yayınlanır;
 * yönetici uygunsuz görseli gerekçesiyle gizleyebilir.
 */
@Injectable()
export class CompanyShowcaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly media: MediaService,
    @Inject(FILE_STORAGE) private readonly storage: MediaStorage,
  ) {}

  async getOwn(ownerId: string) {
    const company = await this.companies.requireCompany(ownerId);
    return this.view(company);
  }

  async update(ownerId: string, dto: UpdateShowcaseDto) {
    const company = await this.companies.requireCompany(ownerId);
    assertNoContactInfo(dto.description, 'Tanıtım yazısı');
    if (dto.foundedYear && dto.foundedYear > new Date().getFullYear()) {
      throw new BadRequestException('Kuruluş yılı gelecekte olamaz');
    }
    const data: Prisma.CompanyUpdateInput = {
      ...(dto.description !== undefined && { description: dto.description || null }),
      // Sıra sabit: sayfada hep aynı düzende görünür
      ...(dto.services && { services: SERVICE_CODES.filter((code) => dto.services!.includes(code)) }),
      ...(dto.foundedYear !== undefined && { foundedYear: dto.foundedYear }),
      ...(dto.fleetSize !== undefined && { fleetSize: dto.fleetSize }),
      ...(dto.staffSize !== undefined && { staffSize: dto.staffSize }),
    };
    await this.prisma.company.update({ where: { id: company.id }, data });
    await this.companies.refreshShowcaseComplete(company.id);
    return this.view(await this.companies.requireCompany(ownerId));
  }

  async createUpload(ownerId: string, dto: CreateShowcaseUploadDto) {
    const company = await this.companies.requireCompany(ownerId);
    const photo = dto.kind === CompanyMediaKind.PHOTO;
    const maxBytes = photo ? SHOWCASE_RULES.photoMaxBytes : SHOWCASE_RULES.logoMaxBytes;
    if (dto.file.sizeBytes > maxBytes || (dto.thumb && dto.thumb.sizeBytes > SHOWCASE_RULES.thumbMaxBytes)) {
      throw new BadRequestException('Görsel çok büyük');
    }
    if (photo && !dto.thumb) throw new BadRequestException('Fotoğrafın önizlemesi eksik');
    if (photo) await this.checkPhotoCount(company.id);
    await this.media.checkQuota(
      dto.file.sizeBytes + (dto.thumb?.sizeBytes ?? 0),
      'Görsel yükleme şu an kullanılamıyor, lütfen daha sonra tekrar dene.',
    );
    const target = (file: { mimeType: string; sizeBytes: number }) => {
      const key = `firmalar/${company.id}/${randomBytes(16).toString('hex')}.${EXTENSIONS[file.mimeType]}`;
      return { key, ...this.storage.createUpload(key, file.mimeType, file.sizeBytes) };
    };
    return { file: target(dto.file), ...(photo && dto.thumb && { thumb: target(dto.thumb) }) };
  }

  async attach(ownerId: string, dto: AttachShowcaseMediaDto) {
    const company = await this.companies.requireCompany(ownerId);
    const prefix = `firmalar/${company.id}/`;
    const photo = dto.kind === CompanyMediaKind.PHOTO;
    if (!dto.key.startsWith(prefix) || (dto.thumbKey && !dto.thumbKey.startsWith(prefix))) {
      throw new BadRequestException('Dosya bu firmaya ait değil');
    }
    if (photo && !dto.thumbKey) throw new BadRequestException('Fotoğrafın önizlemesi eksik');
    assertNoContactInfo(dto.caption, 'Görsel açıklaması');
    // Aynı istek iki kez gelirse ikinci kayıt açılmaz
    if (await this.prisma.companyMedia.findUnique({ where: { storageKey: dto.key } })) return this.view(company);
    if (photo) await this.checkPhotoCount(company.id);

    const [main, thumb] = await Promise.all([
      this.storage.stat(dto.key),
      photo ? this.storage.stat(dto.thumbKey!) : Promise.resolve(null),
    ]);
    const uploaded = [main && { storageKey: dto.key, storage: main.location }, thumb && { storageKey: dto.thumbKey!, storage: thumb.location }]
      .filter((f): f is StoredFile => !!f);
    const allowed = SHOWCASE_RULES.mimeTypes as readonly string[];
    const valid =
      main &&
      allowed.includes(main.mimeType) &&
      main.sizeBytes <= (photo ? SHOWCASE_RULES.photoMaxBytes : SHOWCASE_RULES.logoMaxBytes) &&
      (!photo || (thumb && allowed.includes(thumb.mimeType) && thumb.sizeBytes <= SHOWCASE_RULES.thumbMaxBytes));
    if (!valid) {
      await this.media.deleteObjects(uploaded);
      throw new BadRequestException(
        !main || (photo && !thumb)
          ? 'Görsel yüklenmemiş ya da yükleme yarıda kalmış, tekrar deneyin'
          : 'Görsel türü veya boyutu uygun değil',
      );
    }

    const oldLogos = photo
      ? []
      : await this.prisma.companyMedia.findMany({ where: { companyId: company.id, kind: CompanyMediaKind.LOGO } });
    await this.prisma.$transaction([
      this.prisma.companyMedia.create({
        data: {
          companyId: company.id,
          kind: dto.kind,
          storageKey: dto.key,
          storage: main.location,
          thumbKey: photo ? dto.thumbKey : null,
          thumbStorage: photo ? thumb!.location : null,
          mimeType: main.mimeType,
          sizeBytes: main.sizeBytes + (thumb?.sizeBytes ?? 0),
          width: dto.width ?? null,
          height: dto.height ?? null,
          caption: dto.caption || null,
        },
      }),
      // Yeni logo eskisinin yerini alır
      ...(photo
        ? []
        : [
            this.prisma.companyMedia.deleteMany({ where: { id: { in: oldLogos.map((l) => l.id) } } }),
            this.prisma.company.update({ where: { id: company.id }, data: { logoUrl: publicMediaPath(dto.key) } }),
          ]),
    ]);
    await this.media.deleteObjects(oldLogos.flatMap(filesOf));
    await this.companies.refreshShowcaseComplete(company.id);
    return this.view(await this.companies.requireCompany(ownerId));
  }

  async updateCaption(ownerId: string, mediaId: string, caption: string) {
    const company = await this.companies.requireCompany(ownerId);
    assertNoContactInfo(caption, 'Görsel açıklaması');
    const { count } = await this.prisma.companyMedia.updateMany({
      where: { id: mediaId, companyId: company.id },
      data: { caption: caption || null },
    });
    if (!count) throw new NotFoundException('Görsel bulunamadı');
    return this.view(company);
  }

  async remove(ownerId: string, mediaId: string) {
    const company = await this.companies.requireCompany(ownerId);
    const item = await this.prisma.companyMedia.findFirst({ where: { id: mediaId, companyId: company.id } });
    if (!item) throw new NotFoundException('Görsel bulunamadı');
    await this.prisma.$transaction([
      this.prisma.companyMedia.delete({ where: { id: item.id } }),
      ...(item.kind === CompanyMediaKind.LOGO
        ? [this.prisma.company.update({ where: { id: company.id }, data: { logoUrl: null } })]
        : []),
    ]);
    await this.media.deleteObjects(filesOf(item));
    await this.companies.refreshShowcaseComplete(company.id);
    return this.view(await this.companies.requireCompany(ownerId));
  }

  // ─── Yönetim ─────────────────────────────────────────────────

  /** Yönetimin firma inceleme ekranı için: gizlenenler dahil tüm görseller */
  async listForAdmin(companyId: string) {
    const items = await this.prisma.companyMedia.findMany({ where: { companyId }, orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }] });
    return items.map((m) => this.toMediaView(m));
  }

  /** Uygunsuz görseli gizler (firma panelinde gerekçesiyle görünür) ya da yeniden yayınlar */
  async setHidden(adminId: string, companyId: string, mediaId: string, reason: string | null) {
    const item = await this.prisma.companyMedia.findFirst({ where: { id: mediaId, companyId } });
    if (!item) throw new NotFoundException('Görsel bulunamadı');
    const hide = reason !== null;
    await this.prisma.$transaction([
      this.prisma.companyMedia.update({
        where: { id: item.id },
        data: hide ? { hiddenAt: new Date(), hiddenReason: reason } : { hiddenAt: null, hiddenReason: null },
      }),
      ...(item.kind === CompanyMediaKind.LOGO
        ? [this.prisma.company.update({ where: { id: companyId }, data: { logoUrl: hide ? null : publicMediaPath(item.storageKey) } })]
        : []),
      this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: hide ? 'company.media.hide' : 'company.media.unhide',
          entityType: 'Company',
          entityId: companyId,
          details: { mediaId: item.id, kind: item.kind, reason },
        },
      }),
    ]);
    await this.companies.refreshShowcaseComplete(companyId);
    return this.listForAdmin(companyId);
  }

  /** Hesap silinirken firmanın görselleri depodan da silinir */
  async deleteForCompany(companyId: string) {
    const items = await this.prisma.companyMedia.findMany({ where: { companyId } });
    if (!items.length) return;
    await this.prisma.companyMedia.deleteMany({ where: { companyId } });
    await this.media.deleteObjects(items.flatMap(filesOf));
  }

  // ─── Herkese açık ────────────────────────────────────────────

  /**
   * Herkese açık görsel: yalnızca gizlenmemiş ve firması herkese açık sayfada görünen.
   * Bulunamazsa null (404).
   */
  async readPublic(key: string) {
    const item = await this.prisma.companyMedia.findFirst({
      where: {
        OR: [{ storageKey: key }, { thumbKey: key }],
        hiddenAt: null,
        company: PUBLIC_COMPANY,
      },
    });
    if (!item) return null;
    const location = item.storageKey === key ? item.storage : item.thumbStorage!;
    const file = await this.storage.read(key, location);
    return file && { ...file, mimeType: item.mimeType };
  }

  /**
   * Firma panelinde ve yönetimde gösterilen görsel. Önizleme imzalı kısa süreli adresten gelir
   * (doğrulanmamış firma ya da gizlenen görsel herkese açık adreste görünmez); publicUrl sitedeki adrestir.
   */
  private toMediaView(item: CompanyMedia) {
    return {
      id: item.id,
      kind: item.kind,
      previewUrl: item.thumbKey
        ? this.storage.viewUrl(item.thumbKey, item.thumbStorage!)
        : this.storage.viewUrl(item.storageKey, item.storage),
      fullUrl: this.storage.viewUrl(item.storageKey, item.storage),
      publicUrl: publicMediaPath(item.storageKey),
      width: item.width,
      height: item.height,
      caption: item.caption,
      hidden: !!item.hiddenAt,
      hiddenReason: item.hiddenReason,
      createdAt: item.createdAt,
    };
  }

  private async checkPhotoCount(companyId: string) {
    const count = await this.prisma.companyMedia.count({ where: { companyId, kind: CompanyMediaKind.PHOTO } });
    if (count >= SHOWCASE_RULES.maxPhotos) {
      throw new BadRequestException(`En fazla ${SHOWCASE_RULES.maxPhotos} fotoğraf eklenebilir, önce birini silin`);
    }
  }

  private async view(company: Company) {
    const media = await this.prisma.companyMedia.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: 'asc' },
    });
    const logo = media.find((m) => m.kind === CompanyMediaKind.LOGO);
    const photos = media.filter((m) => m.kind === CompanyMediaKind.PHOTO);
    const visiblePhotos = photos.filter((m) => !m.hiddenAt).length;
    const descriptionLength = company.description?.trim().length ?? 0;
    return {
      description: company.description,
      services: servicesOf(company.services),
      foundedYear: company.foundedYear,
      fleetSize: company.fleetSize,
      staffSize: company.staffSize,
      logo: logo ? this.toMediaView(logo) : null,
      photos: photos.map((m) => this.toMediaView(m)),
      /** Yorumsuz sayfanın arama motorunda listelenmesi için gerekenler */
      indexing: {
        descriptionLength,
        minDescription: INDEX_RULES.minDescription,
        visiblePhotos,
        minPhotos: INDEX_RULES.minPhotos,
        complete: isShowcaseComplete(company.description, visiblePhotos),
        hasReviews: company.ratingCount > 0,
      },
      limits: { maxPhotos: SHOWCASE_RULES.maxPhotos, captionMax: SHOWCASE_RULES.captionMax },
    };
  }
}

const filesOf = (item: CompanyMedia): StoredFile[] => [
  { storageKey: item.storageKey, storage: item.storage },
  ...(item.thumbKey && item.thumbStorage ? [{ storageKey: item.thumbKey, storage: item.thumbStorage }] : []),
];

