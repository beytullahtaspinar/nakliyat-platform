import { createPrivateKey, sign, type KeyObject } from 'node:crypto';
import { IdentityProvider } from '../../generated/prisma/enums.js';
import { verifyIdToken } from './id-token.js';
import { postForm, type AuthorizationParams, type ExchangeParams, type OAuthProfile, type OAuthProvider } from './provider.js';

const AUTH_URL = 'https://appleid.apple.com/auth/authorize';
const TOKEN_URL = 'https://appleid.apple.com/auth/token';
const JWKS_URL = 'https://appleid.apple.com/auth/keys';
const ISSUER = 'https://appleid.apple.com';

export interface AppleConfig {
  /** Services ID (ör. app.evdenevenakliyat.giris) */
  clientId: string;
  teamId: string;
  keyId: string;
  /** "Sign in with Apple" anahtarı (.p8 dosyasının içeriği) */
  privateKey: string;
}

/**
 * Apple ile giriş. Apple ad ve e-posta istendiğinde dönüşü form POST'u ile yapar ve adı yalnızca
 * ilk girişte gönderir. client_secret, .p8 anahtarıyla imzalanan kısa ömürlü bir ES256 JWT'dir.
 */
export class AppleProvider implements OAuthProvider {
  readonly id = 'apple';
  readonly identity = IdentityProvider.APPLE;
  private readonly key: KeyObject;

  constructor(private readonly cfg: AppleConfig) {
    // cPanel ortam değişkeninde satır sonları \n olarak yazılabilir
    this.key = createPrivateKey(cfg.privateKey.replace(/\\n/g, '\n'));
  }

  authorizationUrl({ redirectUri, state, nonce }: AuthorizationParams) {
    const params = new URLSearchParams({
      client_id: this.cfg.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      response_mode: 'form_post',
      scope: 'name email',
      state,
      nonce,
    });
    return `${AUTH_URL}?${params}`;
  }

  async exchange({ code, redirectUri, nonce, appleUser }: ExchangeParams): Promise<OAuthProfile> {
    const idToken = await postForm(
      TOKEN_URL,
      {
        code,
        client_id: this.cfg.clientId,
        client_secret: this.clientSecret(),
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      },
      'Apple',
    );
    const claims = await verifyIdToken(idToken, { jwksUrl: JWKS_URL, issuers: [ISSUER], audience: this.cfg.clientId, nonce });
    return {
      subject: claims.sub,
      email: typeof claims.email === 'string' ? claims.email.toLowerCase() : null,
      // Apple bu alanı metin ("true") ya da mantıksal değer olarak gönderebilir
      emailVerified: claims.email_verified === true || claims.email_verified === 'true',
      name: nameFrom(appleUser),
    };
  }

  /** Apple'ın istediği client_secret: 5 dakika geçerli ES256 JWT */
  clientSecret(now = Math.floor(Date.now() / 1000)) {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const header = encode({ alg: 'ES256', kid: this.cfg.keyId, typ: 'JWT' });
    const payload = encode({ iss: this.cfg.teamId, iat: now, exp: now + 300, aud: ISSUER, sub: this.cfg.clientId });
    const signature = sign('sha256', Buffer.from(`${header}.${payload}`), { key: this.key, dsaEncoding: 'ieee-p1363' });
    return `${header}.${payload}.${signature.toString('base64url')}`;
  }
}

function nameFrom(appleUser?: string): string | null {
  if (!appleUser) return null;
  try {
    const { name } = JSON.parse(appleUser) as { name?: { firstName?: string; lastName?: string } };
    const full = [name?.firstName, name?.lastName].filter(Boolean).join(' ').trim();
    return full || null;
  } catch {
    return null;
  }
}
