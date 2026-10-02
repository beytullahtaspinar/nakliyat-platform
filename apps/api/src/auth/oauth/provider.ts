import type { IdentityProvider } from '../../generated/prisma/enums.js';

/** Sağlayıcıdan gelen ve doğrulanmış kullanıcı bilgisi */
export interface OAuthProfile {
  subject: string;
  email: string | null;
  emailVerified: boolean;
  /** Apple adı yalnızca ilk girişte, id_token dışında gönderir */
  name: string | null;
}

export interface AuthorizationParams {
  redirectUri: string;
  state: string;
  nonce: string;
  /** PKCE (S256). Apple desteklemediği için yok sayar. */
  codeChallenge: string;
  loginHint?: string;
}

export interface ExchangeParams {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  nonce: string;
  /** Apple ilk girişte adı form alanında yollar: {"name":{"firstName","lastName"}} */
  appleUser?: string;
}

/**
 * Google / Apple ile giriş. Akış: web sağlayıcıya yönlendirir (authorizationUrl), sağlayıcı web'e
 * kodla döner, API kodu sağlayıcıda id_token ile değiştirip doğrular (exchange).
 * Gizli anahtarlar yalnızca API'de durur.
 */
export interface OAuthProvider {
  /** URL'deki ad: google, apple */
  readonly id: string;
  readonly identity: IdentityProvider;
  authorizationUrl(params: AuthorizationParams): string;
  exchange(params: ExchangeParams): Promise<OAuthProfile>;
}

/** Yapılandırılmış sağlayıcılar; anahtarı olmayan listede yer almaz ve düğmesi görünmez */
export const OAUTH_PROVIDERS = Symbol('OAUTH_PROVIDERS');

export async function postForm(url: string, form: Record<string, string>, label: string) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams(form).toString(),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || typeof body?.id_token !== 'string') {
    // Gövdede yalnızca hata kodu olur (ör. invalid_grant); gizli anahtar içermez
    throw new Error(`${label} ${res.status}: ${String(body?.error ?? 'id_token yok')}`);
  }
  return body.id_token;
}
