import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { Readable } from 'node:stream';
import { EXTENSIONS } from './media-rules.js';
import { presignUrl } from './s3-presign.js';
import { viewWindow, type StoredObject } from './storage.js';

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Test için; boşsa https://<accountId>.r2.cloudflarestorage.com */
  endpoint?: string;
};

/** Cloudflare R2 (S3 uyumlu). API dosyayı imzalı PUT ile aktarır; görüntüleme imzalı GET adresiyle. */
export class R2Storage {
  constructor(private readonly config: R2Config) {}

  write(key: string, mimeType: string, sizeBytes: number, body: Readable): Promise<void> {
    const headers = { 'Content-Type': mimeType, 'Content-Length': String(sizeBytes) };
    // Boyut imzaya katılır: R2 farklı uzunlukta gövdeyi kabul etmez
    const url = new URL(this.sign('PUT', key, 5 * 60, new Date(), headers));
    const request = url.protocol === 'http:' ? httpRequest : httpsRequest;
    return new Promise((resolve, reject) => {
      const req = request(url, { method: 'PUT', headers }, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          if (text.length < 500) text += chunk;
        });
        res.on('end', () => {
          const status = res.statusCode ?? 0;
          if (status >= 200 && status < 300) resolve();
          else reject(new Error(`R2 PUT ${status}: ${text.slice(0, 500)}`));
        });
        res.on('error', reject);
      });
      req.on('error', reject);
      // R2 cevap vermezse yükleme askıda kalmasın, dosya diske kaydedilsin
      req.setTimeout(60_000, () => req.destroy(new Error('R2 PUT zaman aşımı')));
      body.on('error', (err) => {
        req.destroy(err);
        reject(err);
      });
      body.pipe(req);
    });
  }

  async stat(key: string): Promise<StoredObject | null> {
    const res = await fetch(this.sign('HEAD', key, 60, new Date()), { method: 'HEAD', signal: AbortSignal.timeout(15_000) });
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
    const res = await fetch(this.sign('DELETE', key, 60, new Date()), { method: 'DELETE', signal: AbortSignal.timeout(15_000) });
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
