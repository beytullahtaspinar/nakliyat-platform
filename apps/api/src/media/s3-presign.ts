import { createHash, createHmac } from 'node:crypto';

/**
 * S3 uyumlu depolama (Cloudflare R2) için imzalı adres üretir: AWS Signature V4, sorgu dizesiyle.
 * Tek bir küçük fonksiyon için AWS SDK'yı (birkaç MB) pakete eklememek için elle yazıldı.
 * Doğruluğu AWS belgelerindeki örnekle test ediliyor (s3-presign.spec.ts).
 */
export type PresignOptions = {
  method: 'GET' | 'HEAD' | 'PUT' | 'DELETE';
  /** Nesnenin tam adresi, ör. https://<hesap>.r2.cloudflarestorage.com/<kova>/<anahtar> */
  url: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresInSec: number;
  date: Date;
  /** İmzaya katılan ek başlıklar; istemci bunları birebir aynı göndermek zorunda (ör. content-type, content-length) */
  headers?: Record<string, string>;
};

const sha256 = (data: string) => createHash('sha256').update(data).digest('hex');
const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data).digest();

/** RFC 3986: harf, rakam ve -._~ dışındaki her karakter kodlanır */
const encode = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export function presignUrl(options: PresignOptions): string {
  const url = new URL(options.url);
  const amzDate = options.date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const day = amzDate.slice(0, 8);
  const scope = `${day}/${options.region}/s3/aws4_request`;

  const headers: Record<string, string> = { host: url.host };
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    headers[name.toLowerCase()] = value.trim();
  }
  const headerNames = Object.keys(headers).sort();
  const signedHeaders = headerNames.join(';');

  const query: [string, string][] = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${options.accessKeyId}/${scope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(options.expiresInSec)],
    ['X-Amz-SignedHeaders', signedHeaders],
  ];
  const canonicalQuery = query
    .map(([k, v]) => `${encode(k)}=${encode(v)}`)
    .sort()
    .join('&');
  const canonicalPath = url.pathname
    .split('/')
    .map((segment) => encode(decodeURIComponent(segment)))
    .join('/');

  const canonicalRequest = [
    options.method,
    canonicalPath,
    canonicalQuery,
    headerNames.map((name) => `${name}:${headers[name]}\n`).join(''),
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');

  let key = hmac(`AWS4${options.secretAccessKey}`, day);
  for (const part of [options.region, 's3', 'aws4_request']) key = hmac(key, part);
  const signature = createHmac('sha256', key).update(stringToSign).digest('hex');

  return `${url.origin}${canonicalPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
