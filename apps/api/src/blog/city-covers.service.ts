import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MediaService } from '../media/media.service.js';
import { isLocalPageSlug } from './local-page-rules.js';

/** Hazır il kapakları: apps/api/il-kapaklari (manifest.json + WebP dosyaları), sürüm paketine girer. Testte değiştirilebilir. */
const coversDir = () => process.env.CITY_COVERS_DIR ?? resolve(import.meta.dirname, '../../il-kapaklari');

export type CityCoverEntry = {
  /** Bölge sayfası adresi: usak-evden-eve-nakliyat */
  slug: string;
  /** Büyük boy (1600 px'e kadar) ve önizleme (800 px) WebP dosyaları, klasöre göre */
  file: string;
  thumb: string;
  width: number;
  height: number;
  thumbWidth: number;
  thumbHeight: number;
  /** Fotoğrafta görüneni anlatan alt metin */
  alt: string;
  /** Lisans şartı: fotoğrafçı, lisans ve kaynak sayfası (Wikimedia Commons) */
  credit: { author: string; license: string; licenseUrl: string | null; sourceUrl: string };
};

/**
 * İl sayfalarına hazır, lisanslı kapak görseli ekler. Yönetimde kapak seçilmiş sayfaya dokunmaz
 * (ör. elle eklenen Uşak görseli kalır); tekrar çalıştırılırsa aynı dosyayı ikinci kez yüklemez.
 */
@Injectable()
export class CityCoversService {
  private readonly logger = new Logger('CityCovers');

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  async manifest(dir = coversDir()): Promise<CityCoverEntry[]> {
    try {
      const entries = JSON.parse(await readFile(resolve(dir, 'manifest.json'), 'utf8')) as CityCoverEntry[];
      return entries.filter((e) => isLocalPageSlug(e.slug) && e.credit?.author && e.credit?.license && e.credit?.sourceUrl);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  /** Kaç il sayfasına eklenebilir (kapağı olmayanlar) */
  async status(dir = coversDir()) {
    const entries = await this.manifest(dir);
    const covered = await this.coveredSlugs(entries.map((e) => e.slug));
    return { total: entries.length, available: entries.filter((e) => !covered.has(e.slug)).length };
  }

  async import(adminId: string, dir = coversDir()) {
    const entries = await this.manifest(dir);
    const covered = await this.coveredSlugs(entries.map((e) => e.slug));
    const todo = entries.filter((e) => !covered.has(e.slug));
    const added: string[] = [];
    for (const entry of todo) {
      const storageKey = await this.mediaFor(entry, dir);
      // Kapak bu arada yönetimden seçildiyse üzerine yazılmaz
      const { count } = await this.prisma.localPageContent.updateMany({
        where: { slug: entry.slug, coverKey: null },
        data: { coverKey: storageKey, coverAlt: entry.alt, updatedById: adminId },
      });
      if (!count) {
        const exists = await this.prisma.localPageContent.findUnique({ where: { slug: entry.slug }, select: { slug: true } });
        if (exists) continue;
        await this.prisma.localPageContent.create({
          data: { slug: entry.slug, coverKey: storageKey, coverAlt: entry.alt, updatedById: adminId },
        });
      }
      added.push(entry.slug);
    }
    if (added.length) {
      await this.prisma.auditLog.create({
        data: { actorId: adminId, action: 'local-page.city-covers', entityType: 'LocalPageContent', entityId: 'il-kapaklari', details: { slugs: added } },
      });
    }
    this.logger.log(`${added.length} il sayfasına kapak eklendi`);
    return { added, skipped: entries.length - added.length };
  }

  private async coveredSlugs(slugs: string[]) {
    const rows = await this.prisma.localPageContent.findMany({
      where: { slug: { in: slugs }, coverKey: { not: null } },
      select: { slug: true },
    });
    return new Set(rows.map((r) => r.slug));
  }

  /** Görsel kütüphanesindeki kaydı (aynı kaynaktan daha önce yüklendiyse onu) döner, yoksa yükler */
  private async mediaFor(entry: CityCoverEntry, dir: string) {
    const existing = await this.prisma.blogMedia.findFirst({
      where: { creditSourceUrl: entry.credit.sourceUrl },
      select: { storageKey: true },
    });
    if (existing) return existing.storageKey;

    const upload = async (name: string) => {
      const path = resolve(dir, name);
      const { size } = await stat(path);
      const key = `blog/${randomBytes(16).toString('hex')}.webp`;
      const location = await this.media.receive(key, 'image/webp', size, createReadStream(path));
      return { key, location, size };
    };
    const main = await upload(entry.file);
    const thumb = await upload(entry.thumb);
    await this.prisma.blogMedia.create({
      data: {
        storageKey: main.key,
        storage: main.location,
        thumbKey: thumb.key,
        thumbStorage: thumb.location,
        mimeType: 'image/webp',
        sizeBytes: main.size + thumb.size,
        width: entry.width,
        height: entry.height,
        thumbWidth: entry.thumbWidth,
        thumbHeight: entry.thumbHeight,
        alt: entry.alt,
        creditAuthor: entry.credit.author,
        creditLicense: entry.credit.license,
        creditLicenseUrl: entry.credit.licenseUrl,
        creditSourceUrl: entry.credit.sourceUrl,
      },
    });
    return main.key;
  }
}
