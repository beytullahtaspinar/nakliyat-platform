import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { FileTokens } from './file-tokens.js';
import { MIME_BY_EXTENSION, STORAGE_KEY_PATTERN } from './media-rules.js';
import { apiBase, apiUploadTarget, viewWindow, type FileStorage, type StoredObject, type UploadTarget } from './storage.js';

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
  readonly tokens: FileTokens;

  constructor(private readonly config: LocalConfig) {
    this.quotaBytes = config.quotaBytes;
    this.tokens = new FileTokens(config.secret);
  }

  createUpload(key: string, mimeType: string, sizeBytes: number): UploadTarget {
    return apiUploadTarget(this.config.publicUrl, this.tokens, key, mimeType, sizeBytes);
  }

  /** Yarım kalan yükleme görünmesin: önce geçici dosyaya yazılır, boyut tutarsa taşınır */
  async write(key: string, _mimeType: string, sizeBytes: number, body: Readable): Promise<void> {
    const target = this.path(key);
    await mkdir(dirname(target), { recursive: true });
    const temp = `${target}.${process.pid}.${Date.now()}.part`;
    try {
      await pipeline(body, createWriteStream(temp));
      if ((await stat(temp)).size !== sizeBytes) throw new Error('Yükleme yarıda kaldı');
      await rename(temp, target);
    } catch (err) {
      await rm(temp, { force: true });
      throw err;
    }
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
    return `${apiBase(this.config.publicUrl)}/files/${this.tokens.sign({ k: key, m: 'get', e: viewWindow().expiresAt })}`;
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  path(key: string): string {
    if (!STORAGE_KEY_PATTERN.test(key)) throw new Error('Geçersiz dosya anahtarı');
    return join(this.config.dir, key);
  }
}
