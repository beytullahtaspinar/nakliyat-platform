import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { FileTokens } from './file-tokens.js';
import { MIME_BY_EXTENSION, STORAGE_KEY_PATTERN } from './media-rules.js';
import { UPLOAD_TTL_SEC, viewWindow, type StoredObject, type UploadTarget } from './storage.js';

export type LocalConfig = {
  dir: string;
  /** Dışarıdan erişilen API adresi, ör. https://api.evdenevenakliyat.app */
  publicUrl: string;
  secret: string;
};

/** Sunucu diski: yüklemeler buradan geçer, R2 kullanılamazsa dosyalar burada kalır */
export class LocalStorage {
  readonly tokens: FileTokens;

  constructor(private readonly config: LocalConfig) {
    this.tokens = new FileTokens(config.secret);
  }

  /** Tarayıcı dosyayı API'ye yükler: PUT <api>/v1/files/upload/<imzalı belirteç> */
  uploadTarget(key: string, mimeType: string, sizeBytes: number): UploadTarget {
    const token = this.tokens.sign({ k: key, m: 'put', t: mimeType, s: sizeBytes, e: Date.now() + UPLOAD_TTL_SEC * 1000 });
    return { method: 'PUT', headers: { 'Content-Type': mimeType }, url: `${this.base}/files/upload/${token}` };
  }

  /** Yarım kalan yükleme görünmesin: önce geçici dosyaya yazılır, boyut tutarsa geçici dosyanın yolu döner */
  async writeTemp(key: string, sizeBytes: number, body: Readable): Promise<string> {
    const target = this.path(key);
    await mkdir(dirname(target), { recursive: true });
    const temp = `${target}.${process.pid}.${Date.now()}.part`;
    try {
      await pipeline(body, createWriteStream(temp));
      if ((await stat(temp)).size !== sizeBytes) throw new Error('Yükleme yarıda kaldı');
      return temp;
    } catch (err) {
      await this.discard(temp);
      throw err;
    }
  }

  commit(temp: string, key: string) {
    return rename(temp, this.path(key));
  }

  discard(temp: string) {
    return rm(temp, { force: true });
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
    return `${this.base}/files/${this.tokens.sign({ k: key, m: 'get', e: viewWindow().expiresAt })}`;
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  path(key: string): string {
    if (!STORAGE_KEY_PATTERN.test(key)) throw new Error('Geçersiz dosya anahtarı');
    return join(this.config.dir, key);
  }

  private get base() {
    return `${this.config.publicUrl.replace(/\/$/, '')}/v1`;
  }
}
