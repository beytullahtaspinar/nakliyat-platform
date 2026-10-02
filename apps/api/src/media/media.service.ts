import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { RequestMedia } from '../generated/prisma/client.js';
import { MediaType, RequestStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AttachMediaDto, CreateUploadsDto } from './dto/media.dto.js';
import { EXTENSIONS, MEDIA_RULES, mediaTypeOf } from './media-rules.js';
import { FILE_STORAGE, type FileStorage } from './storage.js';

const LIMIT_LABEL = { [MediaType.PHOTO]: 'fotoğraf', [MediaType.VIDEO]: 'video' } as const;
const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

/**
 * Talep fotoğraf/videoları. Akış:
 * 1. createUploads: müşteri dosya türü ve boyutunu bildirir, her dosya için kısa süreli yükleme adresi alır.
 * 2. Tarayıcı küçültülmüş dosyayı doğrudan depoya yükler (API'den geçmez; yerel sürücüde API'ye yazılır).
 * 3. attach: yüklenen dosyalar depoda doğrulanıp talebe bağlanır.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async createUploads(customerId: string, requestId: string, { files }: CreateUploadsDto) {
    await this.requireEditable(customerId, requestId);
    const existing = await this.countByType(requestId);
    for (const type of [MediaType.PHOTO, MediaType.VIDEO]) {
      const incoming = files.filter((f) => mediaTypeOf(f.mimeType) === type).length;
      this.checkCount(type, existing[type] + incoming);
    }
    for (const file of files) {
      const rule = MEDIA_RULES[mediaTypeOf(file.mimeType)];
      if (file.sizeBytes > rule.maxBytes) {
        throw new BadRequestException(`Dosya çok büyük: ${LIMIT_LABEL[mediaTypeOf(file.mimeType)]} en fazla ${mb(rule.maxBytes)} olabilir`);
      }
    }
    await this.checkQuota(
      files.reduce((sum, f) => sum + f.sizeBytes, 0),
      'Dosya yükleme şu an kullanılamıyor, talebini fotoğrafsız gönderebilirsin.',
    );

    return {
      uploads: files.map((file) => {
        const key = `talepler/${requestId}/${randomBytes(16).toString('hex')}.${EXTENSIONS[file.mimeType]}`;
        return { key, ...this.storage.createUpload(key, file.mimeType, file.sizeBytes) };
      }),
    };
  }

  async attach(customerId: string, requestId: string, { items }: AttachMediaDto) {
    await this.requireEditable(customerId, requestId);
    const prefix = `talepler/${requestId}/`;
    const unique = [...new Map(items.map((i) => [i.key, i])).values()];
    if (unique.some((i) => !i.key.startsWith(prefix))) throw new BadRequestException('Dosya bu talebe ait değil');

    const already = new Set(
      (await this.prisma.requestMedia.findMany({ where: { storageKey: { in: unique.map((i) => i.key) } } })).map(
        (m) => m.storageKey,
      ),
    );
    const fresh = unique.filter((i) => !already.has(i.key));
    const stored = await Promise.all(fresh.map((i) => this.storage.stat(i.key)));

    const rows = fresh.map((item, index) => {
      const object = stored[index];
      if (!object) throw new BadRequestException('Dosya yüklenmemiş ya da yükleme yarıda kalmış, tekrar deneyin');
      const type = mediaTypeOf(object.mimeType);
      const rule = MEDIA_RULES[type];
      if (!(rule.mimeTypes as readonly string[]).includes(object.mimeType) || object.sizeBytes > rule.maxBytes) {
        throw new BadRequestException('Dosya türü veya boyutu uygun değil');
      }
      return {
        requestId,
        type,
        storageKey: item.key,
        mimeType: object.mimeType,
        sizeBytes: object.sizeBytes,
        width: item.width ?? null,
        height: item.height ?? null,
        durationSec: type === MediaType.VIDEO ? (item.durationSec ?? null) : null,
      };
    });

    const existing = await this.countByType(requestId);
    for (const type of [MediaType.PHOTO, MediaType.VIDEO]) {
      this.checkCount(type, existing[type] + rows.filter((r) => r.type === type).length);
    }
    if (rows.length) await this.prisma.requestMedia.createMany({ data: rows, skipDuplicates: true });
    return this.listForRequest(requestId);
  }

  async remove(customerId: string, requestId: string, mediaId: string) {
    await this.requireEditable(customerId, requestId);
    const media = await this.prisma.requestMedia.findFirst({ where: { id: mediaId, requestId } });
    if (!media) throw new NotFoundException('Dosya bulunamadı');
    await this.prisma.requestMedia.delete({ where: { id: media.id } });
    await this.deleteObjects([media.storageKey]);
  }

  /** Talebin dosyaları, kısa süreli görüntüleme adresleriyle */
  async listForRequest(requestId: string) {
    const media = await this.prisma.requestMedia.findMany({ where: { requestId }, orderBy: { createdAt: 'asc' } });
    return media.map((m) => this.toView(m));
  }

  toView(media: RequestMedia) {
    return {
      id: media.id,
      type: media.type,
      mimeType: media.mimeType,
      sizeBytes: media.sizeBytes,
      width: media.width,
      height: media.height,
      durationSec: media.durationSec,
      url: this.storage.viewUrl(media.storageKey),
      createdAt: media.createdAt,
    };
  }

  /** Hesap silinirken müşterinin tüm talep dosyaları kalıcı olarak silinir (KVKK). */
  async deleteForCustomer(customerId: string) {
    const media = await this.prisma.requestMedia.findMany({
      where: { request: { customerId } },
      select: { storageKey: true },
    });
    if (!media.length) return;
    await this.prisma.requestMedia.deleteMany({ where: { request: { customerId } } });
    await this.deleteObjects(media.map((m) => m.storageKey));
  }

  async deleteObjects(keys: string[]) {
    const results = await Promise.allSettled(keys.map((key) => this.storage.delete(key)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed) this.logger.warn(`${failed} dosya depodan silinemedi`);
  }

  private async requireEditable(customerId: string, requestId: string) {
    const request = await this.prisma.movingRequest.findFirst({
      where: { id: requestId, customerId, deletedAt: null },
      select: { status: true },
    });
    if (!request) throw new NotFoundException('Talep bulunamadı');
    // Taslak: hesap doğrulaması bekleyen talep (bkz. VerificationService)
    if (request.status !== RequestStatus.OPEN && request.status !== RequestStatus.DRAFT) {
      throw new ConflictException('Yalnızca açık taleplere fotoğraf ve video eklenebilir');
    }
  }

  private async countByType(requestId: string) {
    const groups = await this.prisma.requestMedia.groupBy({ by: ['type'], where: { requestId }, _count: true });
    const counts = { [MediaType.PHOTO]: 0, [MediaType.VIDEO]: 0 };
    for (const g of groups) counts[g.type] = g._count;
    return counts;
  }

  private checkCount(type: MediaType, total: number) {
    const { maxCount } = MEDIA_RULES[type];
    if (total > maxCount) {
      throw new BadRequestException(`Bir talebe en fazla ${maxCount} ${LIMIT_LABEL[type]} eklenebilir`);
    }
  }

  /**
   * Toplam boyut sınırı: sunucu diski (2 GB) ya da R2 ücretsiz katmanı (10 GB) dolmasın.
   * Talep dosyaları ve firma belgeleri aynı depoyu paylaşır.
   */
  async checkQuota(incomingBytes: number, message: string) {
    const [media, documents] = await Promise.all([
      this.prisma.requestMedia.aggregate({ _sum: { sizeBytes: true } }),
      this.prisma.companyDocument.aggregate({ _sum: { sizeBytes: true } }),
    ]);
    const used = (media._sum.sizeBytes ?? 0) + (documents._sum.sizeBytes ?? 0);
    if (used + incomingBytes > this.storage.quotaBytes) {
      this.logger.error(
        this.storage.driver === 'r2'
          ? 'R2 dosya kotası (R2_QUOTA_GB) doldu, yükleme durdu (docs/dosya-yukleme.md)'
          : 'Yerel dosya kotası doldu; R2 depolamaya geçilmeli (docs/dosya-yukleme.md)',
      );
      throw new ConflictException(message);
    }
  }
}
