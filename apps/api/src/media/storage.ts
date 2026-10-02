import { createReadStream } from 'node:fs';
import type { Readable } from 'node:stream';
import { Logger } from '@nestjs/common';
import { StorageLocation } from '../generated/prisma/enums.js';
import type { LocalStorage } from './local-storage.js';
import type { R2Storage } from './r2-storage.js';

/**
 * Hibrit dosya deposu (docs/dosya-yukleme.md):
 * - Tarayıcı küçültülmüş dosyayı API'ye yükler (PUT /v1/files/upload/:token).
 * - API dosyayı önce sunucu diskine geçici olarak yazar, sonra Cloudflare R2'ye aktarır ve geçici dosyayı siler.
 * - R2 ayarlı değilse, hata verirse ya da kotası dolduysa dosya sunucu diskinde (canlıda ~/yuklemeler) kalır.
 *   Hata sonrası R2 bir süre denenmez; MediaService diskte kalan dosyaları R2 düzelince oraya taşır.
 */
export type UploadTarget = {
  url: string;
  method: 'PUT';
  /** Tarayıcının birebir göndermesi gereken başlıklar */
  headers: Record<string, string>;
};

export type StoredObject = { sizeBytes: number; mimeType: string };

export type StorageQuotas = {
  /** Sunucu diski için toplam sınır (bayt): paketin diski 2 GB */
  local: number;
  /** R2 için toplam sınır (bayt): ücretsiz katman (10 GB) aşılmasın */
  r2: number;
};

export const FILE_STORAGE = Symbol('FILE_STORAGE');

/** Yükleme adresleri bu kadar süre geçerli */
export const UPLOAD_TTL_SEC = 30 * 60;
/** R2 hata verince bu süre boyunca denenmez, dosyalar diske yazılır */
export const R2_COOLDOWN_MS = 10 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export class MediaStorage {
  private readonly logger = new Logger('MediaStorage');
  private r2PausedUntil = 0;

  constructor(
    readonly local: LocalStorage,
    readonly r2: R2Storage | null,
    readonly quotas: StorageQuotas,
  ) {}

  get tokens() {
    return this.local.tokens;
  }

  /** R2 ayarlı ve son hatadan bu yana bekleme süresi dolmuş mu */
  r2Ready(now = Date.now()) {
    return this.r2 !== null && now >= this.r2PausedUntil;
  }

  createUpload(key: string, mimeType: string, sizeBytes: number): UploadTarget {
    return this.local.uploadTarget(key, mimeType, sizeBytes);
  }

  /**
   * Gelen dosyayı kaydeder ve nereye kaydettiğini döner. Boyut tutmazsa hata verir.
   * useR2: R2 kotasında yer var mı (MediaService veritabanından hesaplar).
   */
  async write(key: string, mimeType: string, sizeBytes: number, body: Readable, useR2: boolean) {
    const temp = await this.local.writeTemp(key, sizeBytes, body);
    try {
      if (useR2 && this.r2Ready()) {
        try {
          await this.r2!.write(key, mimeType, sizeBytes, createReadStream(temp));
          await this.local.discard(temp);
          return StorageLocation.R2;
        } catch (err) {
          this.r2Failed(err);
        }
      }
      await this.local.commit(temp, key);
      return StorageLocation.LOCAL;
    } catch (err) {
      await this.local.discard(temp);
      throw err;
    }
  }

  /** Dosya nerede ve özellikleri ne; yoksa null */
  async stat(key: string): Promise<(StoredObject & { location: StorageLocation }) | null> {
    const local = await this.local.stat(key);
    if (local) return { ...local, location: StorageLocation.LOCAL };
    const remote = this.r2 ? await this.r2.stat(key) : null;
    return remote ? { ...remote, location: StorageLocation.R2 } : null;
  }

  viewUrl(key: string, location: StorageLocation) {
    return location === StorageLocation.R2 && this.r2 ? this.r2.viewUrl(key) : this.local.viewUrl(key);
  }

  async delete(key: string, location: StorageLocation) {
    if (location === StorageLocation.R2) await this.r2?.delete(key);
    else await this.local.delete(key);
  }

  /** Diskteki dosyayı R2'ye kopyalar (disktekini silmez). Başarısızsa R2 bir süre denenmez. */
  async copyToR2(key: string, mimeType: string, sizeBytes: number): Promise<boolean> {
    if (!this.r2Ready()) return false;
    try {
      await this.r2!.write(key, mimeType, sizeBytes, createReadStream(this.local.path(key)));
      this.r2PausedUntil = 0;
      return true;
    } catch (err) {
      this.r2Failed(err);
      return false;
    }
  }

  private r2Failed(err: unknown) {
    this.r2PausedUntil = Date.now() + R2_COOLDOWN_MS;
    this.logger.error(
      `R2'ye yazılamadı, dosyalar ${R2_COOLDOWN_MS / 60000} dakika sunucu diskine kaydedilecek: ${(err as Error).message}`,
    );
  }
}

/**
 * Görüntüleme adresi saat başına sabitlenir (aynı saat içinde aynı adres), böylece tarayıcı
 * önbelleği çalışır; adres en az 1, en çok 2 saat geçerli kalır.
 */
export function viewWindow(now = Date.now()) {
  const start = Math.floor(now / HOUR_MS) * HOUR_MS;
  return { start: new Date(start), expiresAt: start + 2 * HOUR_MS, expiresInSec: 2 * 60 * 60 };
}
