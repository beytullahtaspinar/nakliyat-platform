import { EXTENSIONS } from './media-rules.js';
import { presignUrl } from './s3-presign.js';
import { UPLOAD_TTL_SEC, viewWindow, type FileStorage, type StoredObject, type UploadTarget } from './storage.js';

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Test için; boşsa https://<accountId>.r2.cloudflarestorage.com */
  endpoint?: string;
  /** Toplam boyut sınırı (bayt): ücretsiz katman (10 GB) aşılmasın diye */
  quotaBytes: number;
};

export class R2Storage implements FileStorage {
  readonly driver = 'r2' as const;
  readonly quotaBytes: number;

  constructor(private readonly config: R2Config) {
    this.quotaBytes = config.quotaBytes;
  }

  createUpload(key: string, mimeType: string, sizeBytes: number): UploadTarget {
    const headers = { 'Content-Type': mimeType };
    return {
      method: 'PUT',
      headers,
      // Boyut imzaya katılır: tarayıcı bildirdiğinden büyük dosya yükleyemez
      url: this.sign('PUT', key, UPLOAD_TTL_SEC, new Date(), { ...headers, 'Content-Length': String(sizeBytes) }),
    };
  }

  async stat(key: string): Promise<StoredObject | null> {
    const res = await fetch(this.sign('HEAD', key, 60, new Date()), { method: 'HEAD' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`R2 HEAD ${res.status}`);
    const ext = key.split('.').pop() ?? '';
    const mimeType = res.headers.get('content-type') ?? '';
    return {
      sizeBytes: Number(res.headers.get('content-length') ?? 0),
      // Uzantıyla uyuşmayan tür kabul edilmez
      mimeType: EXTENSIONS[mimeType] === ext ? mimeType : '',
    };
  }

  viewUrl(key: string): string {
    const { start, expiresInSec } = viewWindow();
    return this.sign('GET', key, expiresInSec, start);
  }

  async delete(key: string): Promise<void> {
    const res = await fetch(this.sign('DELETE', key, 60, new Date()), { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE ${res.status}`);
  }

  private sign(
    method: 'GET' | 'HEAD' | 'PUT' | 'DELETE',
    key: string,
    expiresInSec: number,
    date: Date,
    headers?: Record<string, string>,
  ) {
    const endpoint = (this.config.endpoint ?? `https://${this.config.accountId}.r2.cloudflarestorage.com`).replace(/\/$/, '');
    return presignUrl({
      method,
      url: `${endpoint}/${this.config.bucket}/${key}`,
      region: 'auto',
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      expiresInSec,
      date,
      headers,
    });
  }
}
