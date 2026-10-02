import { createPublicKey, createVerify, type JsonWebKey, type KeyObject } from 'node:crypto';

const JWKS_TTL_MS = 60 * 60_000;
const CLOCK_SKEW_S = 60;
const cache = new Map<string, { keys: Map<string, KeyObject>; fetchedAt: number }>();

export interface IdTokenCheck {
  jwksUrl: string;
  issuers: string[];
  audience: string;
  nonce: string;
}

export type IdTokenClaims = Record<string, unknown> & { sub: string };

/**
 * OpenID Connect kimlik belirtecini (id_token) doğrular: RS256 imzası sağlayıcının açık
 * anahtarlarıyla, ardından iss, aud, exp ve nonce. Ek paket gerektirmez (node:crypto).
 */
export async function verifyIdToken(token: string, check: IdTokenCheck): Promise<IdTokenClaims> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('id_token biçimi geçersiz');
  const [rawHeader, rawPayload, rawSignature] = parts as [string, string, string];
  const header = decode(rawHeader) as { alg?: string; kid?: string };
  if (header.alg !== 'RS256' || !header.kid) throw new Error(`Desteklenmeyen imza: ${header.alg}`);

  const key = await publicKey(check.jwksUrl, header.kid);
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${rawHeader}.${rawPayload}`);
  if (!verifier.verify(key, Buffer.from(rawSignature, 'base64url'))) throw new Error('id_token imzası geçersiz');

  const claims = decode(rawPayload) as IdTokenClaims;
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!check.issuers.includes(String(claims.iss))) throw new Error('id_token yayıncısı geçersiz');
  if (!aud.includes(check.audience)) throw new Error('id_token alıcısı geçersiz');
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_S < now) throw new Error('id_token süresi dolmuş');
  if (claims.nonce !== check.nonce) throw new Error('id_token nonce uyuşmuyor');
  if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('id_token sub yok');
  return claims;
}

async function publicKey(jwksUrl: string, kid: string): Promise<KeyObject> {
  let entry = cache.get(jwksUrl);
  // Anahtar yoksa sağlayıcı anahtarlarını değiştirmiş olabilir: bir kez yeniden çek
  if (!entry || Date.now() - entry.fetchedAt > JWKS_TTL_MS || !entry.keys.has(kid)) {
    entry = await fetchJwks(jwksUrl);
    cache.set(jwksUrl, entry);
  }
  const key = entry.keys.get(kid);
  if (!key) throw new Error('id_token anahtarı bulunamadı');
  return key;
}

async function fetchJwks(jwksUrl: string) {
  const res = await fetch(jwksUrl, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`JWKS ${res.status}`);
  const { keys } = (await res.json()) as { keys: (JsonWebKey & { kid?: string })[] };
  const map = new Map<string, KeyObject>();
  for (const jwk of keys ?? []) {
    if (jwk.kid && jwk.kty === 'RSA') map.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' }));
  }
  return { keys: map, fetchedAt: Date.now() };
}

/** Testler için önbelleği boşaltır */
export function clearJwksCache() {
  cache.clear();
}

function decode(part: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    throw new Error('id_token çözülemedi');
  }
}
