import { createHmac, timingSafeEqual } from 'node:crypto';
import { STORAGE_KEY_PATTERN } from './media-rules.js';

/** İmzalı belirteç içeriği: anahtar, işlem, tür, boyut, son geçerlilik (ms) */
export type FileToken = { k: string; m: 'put' | 'get'; t?: string; s?: number; e: number };

/** API üzerinden yükleme ve (yerel diskte) görüntüleme adresleri için kısa süreli imzalı belirteçler */
export class FileTokens {
  constructor(private readonly secret: string) {}

  sign(payload: FileToken) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${body}.${this.hmac(body)}`;
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

  private hmac(body: string) {
    return createHmac('sha256', this.secret).update(`dosya:${body}`).digest('base64url');
  }
}
