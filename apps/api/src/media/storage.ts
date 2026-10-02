import type { Readable } from 'node:stream';
import type { FileTokens } from './file-tokens.js';

/**
 * Dosya deposu. İki sürücü var:
 * - R2 (Cloudflare, S3 uyumlu): R2_* ortam değişkenleri varsa. Dosya sunucunun diskine yazılmaz,
 *   API onu akış halinde R2'ye aktarır (tarayıcıdan doğrudan R2'ye yükleme R2'nin CORS kontrolüne takıldı).
 *   Canlı için önerilen.
 * - Yerel disk: R2 ayarlı değilse. Dosyalar UPLOAD_DIR klasörüne (canlıda ~/yuklemeler) yazılır,
 *   toplam boyut LOCAL_UPLOAD_QUOTA_MB ile sınırlanır. Geliştirme, test ve R2 kurulana kadar.
 */
export type UploadTarget = {
  url: string;
  method: 'PUT';
  /** Tarayıcının birebir göndermesi gereken başlıklar */
  headers: Record<string, string>;
};

export type StoredObject = { sizeBytes: number; mimeType: string };

export interface FileStorage {
  readonly driver: 'r2' | 'local';
  /** Toplam boyut sınırı (bayt). Dolunca yeni yükleme kabul edilmez, talep fotoğrafsız açılabilir. */
  readonly quotaBytes: number;
  /** Yükleme ve görüntüleme belirteçlerini imzalar */
  readonly tokens: FileTokens;
  createUpload(key: string, mimeType: string, sizeBytes: number): UploadTarget;
  /** PUT /v1/files/upload/:token ile gelen dosyayı kaydeder; boyut tutmazsa hata verir */
  write(key: string, mimeType: string, sizeBytes: number, body: Readable): Promise<void>;
  stat(key: string): Promise<StoredObject | null>;
  viewUrl(key: string): string;
  delete(key: string): Promise<void>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');

/** Yükleme adresleri bu kadar süre geçerli */
export const UPLOAD_TTL_SEC = 30 * 60;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Görüntüleme adresi saat başına sabitlenir (aynı saat içinde aynı adres), böylece tarayıcı
 * önbelleği çalışır; adres en az 1, en çok 2 saat geçerli kalır.
 */
export function viewWindow(now = Date.now()) {
  const start = Math.floor(now / HOUR_MS) * HOUR_MS;
  return { start: new Date(start), expiresAt: start + 2 * HOUR_MS, expiresInSec: 2 * 60 * 60 };
}

/** Tarayıcı dosyayı API'ye yükler: PUT <api>/v1/files/upload/<imzalı belirteç> */
export function apiUploadTarget(
  publicUrl: string,
  tokens: FileTokens,
  key: string,
  mimeType: string,
  sizeBytes: number,
): UploadTarget {
  const token = tokens.sign({ k: key, m: 'put', t: mimeType, s: sizeBytes, e: Date.now() + UPLOAD_TTL_SEC * 1000 });
  return { method: 'PUT', headers: { 'Content-Type': mimeType }, url: `${apiBase(publicUrl)}/files/upload/${token}` };
}

export function apiBase(publicUrl: string) {
  return `${publicUrl.replace(/\/$/, '')}/v1`;
}
