import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { Readable } from 'node:stream';
import type { RequestMedia } from '../generated/prisma/client.js';
import { MediaType, RequestStatus, StorageLocation } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AttachMediaDto, CreateUploadsDto } from './dto/media.dto.js';
import { EXTENSIONS, MEDIA_RULES, mediaTypeOf } from './media-rules.js';
import { FILE_STORAGE, type MediaStorage } from './storage.js';

const LIMIT_LABEL = { [MediaType.PHOTO]: 'fotoğraf', [MediaType.VIDEO]: 'video' } as const;
const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;
/** Diskte kalan dosyalar bu aralıkla R2'ye taşınmaya çalışılır */
const MOVE_INTERVAL_MS = 10 * 60 * 1000;
const MOVE_BATCH = 20;

/**
 * Talep fotoğraf/videoları. Akış:
 * 1. createUploads: müşteri dosya türü ve boyutunu bildirir, her dosya için kısa süreli yükleme adresi alır.
 * 2. receive: tarayıcı küçültülmüş dosyayı API'ye yükler; dosya R2'ye, olmazsa sunucu diskine kaydedilir.
 * 3. attach: yüklenen dosyalar depoda doğrulanıp talebe bağlanır.
 * Diskte kalan dosyalar R2 çalışınca arka planda R2'ye taşınır (moveLocalToR2).
 */
@Injectable()
export class MediaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaService.name);
  private moveTimer?: NodeJS.Timeout;
  private moving = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE) private readonly storage: MediaStorage,
  ) {}

  onModuleInit() {
    if (!this.storage.r2) return;
    this.moveTimer = setInterval(() => void this.moveLocalToR2(), MOVE_INTERVAL_MS);
    this.moveTimer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.moveTimer);
  }

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
    await this.checkQuota(files.reduce((sum, f) => sum + f.sizeBytes, 0));

    return {
      uploads: files.map((file) => {
        const key = `talepler/${requestId}/${randomBytes(16).toString('hex')}.${EXTENSIONS[file.mimeType]}`;
        return { key, ...this.storage.createUpload(key, file.mimeType, file.sizeBytes) };
      }),
    };
  }

  /** Yüklenen dosyayı kaydeder: R2'de yer varsa ve R2 çalışıyorsa R2'ye, değilse sunucu diskine */
  async receive(key: string, mimeType: string, sizeBytes: number, body: Readable) {
    const usage = await this.usage();
    const useR2 = usage[StorageLocation.R2] + sizeBytes <= this.storage.quotas.r2;
    return this.storage.write(key, mimeType, sizeBytes, body, useR2);
  }

  /**
   * Diskte kalan dosyaları R2'ye taşır (R2 kurulmadan ya da R2 hata verirken yüklenenler).
   * Önce R2'ye kopyalanır, kayıt güncellenir, sonra diskteki silinir: arada görüntüleme bozulmaz.
   */
  async moveLocalToR2() {
    if (this.moving || !this.storage.r2Ready()) return 0;
    this.moving = true;
    let moved = 0;
    try {
      const items = await this.prisma.requestMedia.findMany({
        where: { storage: StorageLocation.LOCAL },
        orderBy: { createdAt: 'asc' },
        take: MOVE_BATCH,
      });
      let r2Used = (await this.usage())[StorageLocation.R2];
      for (const item of items) {
        if (r2Used + item.sizeBytes > this.storage.quotas.r2) break;
        if (!(await this.storage.local.stat(item.storageKey))) {
          this.logger.warn(`Diskte bulunamadı, taşınamadı: ${item.storageKey}`);
          continue;
        }
        if (!(await this.storage.copyToR2(item.storageKey, item.mimeType, item.sizeBytes))) break;
        const { count } = await this.prisma.requestMedia.updateMany({
          where: { id: item.id, storage: StorageLocation.LOCAL },
          data: { storage: StorageLocation.R2 },
        });
        if (count) {
          await this.storage.delete(item.storageKey, StorageLocation.LOCAL);
          moved += 1;
          r2Used += item.sizeBytes;
        } else if (!(await this.prisma.requestMedia.findUnique({ where: { id: item.id } }))) {
          // Taşınırken silindi: R2'deki kopya da silinir (başka bir süreç taşıdıysa kayıt durur, dokunulmaz)
          await this.storage.delete(item.storageKey, StorageLocation.R2);
        }
      }
      if (moved) this.logger.log(`${moved} dosya sunucu diskinden R2'ye taşındı`);
    } catch (err) {
      this.logger.error(`Dosyalar R2'ye taşınamadı: ${(err as Error).message}`);
    } finally {
      this.moving = false;
    }
    return moved;
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
        storage: object.location,
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
    await this.deleteObjects([media]);
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
      url: this.storage.viewUrl(media.storageKey, media.storage),
      createdAt: media.createdAt,
    };
  }

  /** Hesap silinirken müşterinin tüm talep dosyaları kalıcı olarak silinir (KVKK). */
  async deleteForCustomer(customerId: string) {
    const media = await this.prisma.requestMedia.findMany({
      where: { request: { customerId } },
      select: { storageKey: true, storage: true },
    });
    if (!media.length) return;
    await this.prisma.requestMedia.deleteMany({ where: { request: { customerId } } });
    await this.deleteObjects(media);
  }

  private async deleteObjects(items: Pick<RequestMedia, 'storageKey' | 'storage'>[]) {
    const results = await Promise.allSettled(items.map((m) => this.storage.delete(m.storageKey, m.storage)));
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

  /** Depo başına kullanılan toplam boyut (bayt) */
  private async usage() {
    const groups = await this.prisma.requestMedia.groupBy({ by: ['storage'], _sum: { sizeBytes: true } });
    const used = { [StorageLocation.LOCAL]: 0, [StorageLocation.R2]: 0 };
    for (const g of groups) used[g.storage] = g._sum.sizeBytes ?? 0;
    return used;
  }

  /**
   * Toplam boyut sınırı: R2 ücretsiz katmanı (10 GB) ya da sunucu diski (2 GB) dolmasın.
   * İkisinden birinde yer varsa yükleme kabul edilir.
   */
  private async checkQuota(incomingBytes: number) {
    const used = await this.usage();
    const { quotas, r2 } = this.storage;
    const r2Room = r2 !== null && used[StorageLocation.R2] + incomingBytes <= quotas.r2;
    const localRoom = used[StorageLocation.LOCAL] + incomingBytes <= quotas.local;
    if (r2Room || localRoom) return;
    this.logger.error(
      r2
        ? 'R2 (R2_QUOTA_GB) ve sunucu diski (LOCAL_UPLOAD_QUOTA_MB) kotası doldu, yükleme durdu (docs/dosya-yukleme.md)'
        : 'Sunucu diski kotası doldu; R2 depolamaya geçilmeli (docs/dosya-yukleme.md)',
    );
    throw new ConflictException('Dosya yükleme şu an kullanılamıyor, talebini fotoğrafsız gönderebilirsin.');
  }
}
