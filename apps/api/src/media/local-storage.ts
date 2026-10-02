import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { MIME_BY_EXTENSION, STORAGE_KEY_PATTERN } from './media-rules.js';
import { UPLOAD_TTL_SEC, viewWindow, type FileStorage, type StoredObject, type UploadTarget } from './storage.js';

/** İmzalı belirteç içeriği: anahtar, işlem, tür, boyut, son geçerlilik (ms) */
export type FileToken = { k: string; m: 'put' | 'get'; t?: string; s?: number; e: number };

export type LocalConfig = {
  dir: string;
  /** Dışarıdan erişilen API adresi, ör. https://api.evdenevenakliyat.app */
  publicUrl: string;
  secret: string;
  quotaBytes: number;
};

export class LocalStorage implements FileStorage {
  readonly driver = 'local' as const;
  readonly quotaBytes: number;

  constructor(private readonly config: LocalConfig) {
    this.quotaBytes = config.quotaBytes;
  }

  createUpload(key: string, mimeType: string, sizeBytes: number): UploadTarget {
    const token = this.sign({ k: key, m: 'put', t: mimeType, s: sizeBytes, e: Date.now() + UPLOAD_TTL_SEC * 1000 });
    return { method: 'PUT', headers: { 'Content-Type': mimeType }, url: `${this.base}/files/upload/${token}` };
  }

  async stat(key: string): Promise<StoredObject | null> {
    try {
      const info = await stat(this.path(key));
      return { sizeBytes: info.size, mimeType: MIME_BY_EXTENSION[key.split('.').pop() ?? ''] ?? '' };
    } catch {
      return null;
    }
  }

  viewUrl(key: string): string {
    return `${this.base}/files/${this.sign({ k: key, m: 'get', e: viewWindow().expiresAt })}`;
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  /** Belirteci doğrular; geçersiz veya süresi dolmuşsa null */
  verify(token: string, mode: FileToken['m']): FileToken | null {
    const [body, signature] = token.split('.');
    if (!body || !signature) return null;
    const expected = Buffer.from(this.hmac(body));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as FileToken;
      if (payload.m !== mode || payload.e < Date.now() || !STORAGE_KEY_PATTERN.test(payload.k)) return null;
      return payload;
    } catch {
      return null;
    }
  }

  path(key: string): string {
    if (!STORAGE_KEY_PATTERN.test(key)) throw new Error('Geçersiz dosya anahtarı');
    return join(this.config.dir, key);
  }

  /** Yarım kalan yükleme görünmesin: önce geçici dosyaya yazılır, bitince taşınır */
  async prepareWrite(key: string) {
    const target = this.path(key);
    await mkdir(dirname(target), { recursive: true });
    const temp = `${target}.${process.pid}.${Date.now()}.part`;
    return {
      temp,
      commit: () => rename(temp, target),
      discard: () => rm(temp, { force: true }),
    };
  }

  private get base() {
    return `${this.config.publicUrl.replace(/\/$/, '')}/v1`;
  }

  private sign(payload: FileToken) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${body}.${this.hmac(body)}`;
  }

  private hmac(body: string) {
    return createHmac('sha256', this.config.secret).update(`dosya:${body}`).digest('base64url');
  }
}
