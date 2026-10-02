/**
 * Dosya deposu. İki sürücü var:
 * - R2 (Cloudflare, S3 uyumlu): R2_* ortam değişkenleri varsa. Tarayıcı dosyayı doğrudan R2'ye yükler,
 *   sunucunun diskine ve bant genişliğine yük binmez. Canlı için önerilen.
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
  /** Yerel diskte toplam kota (bayt); R2'de sınır yok */
  readonly quotaBytes?: number;
  createUpload(key: string, mimeType: string, sizeBytes: number): UploadTarget;
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
