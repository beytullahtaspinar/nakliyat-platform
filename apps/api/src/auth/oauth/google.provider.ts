import { IdentityProvider } from '../../generated/prisma/enums.js';
import { verifyIdToken } from './id-token.js';
import { postForm, type AuthorizationParams, type ExchangeParams, type OAuthProfile, type OAuthProvider } from './provider.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

/** Google ile giriş (OpenID Connect, yetki kodu + PKCE). Kurulum: docs/google-apple-giris.md */
export class GoogleProvider implements OAuthProvider {
  readonly id = 'google';
  readonly identity = IdentityProvider.GOOGLE;

  constructor(private readonly cfg: { clientId: string; clientSecret: string }) {}

  authorizationUrl({ redirectUri, state, nonce, codeChallenge, loginHint }: AuthorizationParams) {
    const params = new URLSearchParams({
      client_id: this.cfg.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
      ...(loginHint && { login_hint: loginHint }),
    });
    return `${AUTH_URL}?${params}`;
  }

  async exchange({ code, redirectUri, codeVerifier, nonce }: ExchangeParams): Promise<OAuthProfile> {
    const idToken = await postForm(
      TOKEN_URL,
      {
        code,
        client_id: this.cfg.clientId,
        client_secret: this.cfg.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      },
      'Google',
    );
    const claims = await verifyIdToken(idToken, {
      jwksUrl: JWKS_URL,
      issuers: ['https://accounts.google.com', 'accounts.google.com'],
      audience: this.cfg.clientId,
      nonce,
    });
    return {
      subject: claims.sub,
      email: typeof claims.email === 'string' ? claims.email.toLowerCase() : null,
      emailVerified: claims.email_verified === true,
      name: typeof claims.name === 'string' ? claims.name : null,
    };
  }
}
