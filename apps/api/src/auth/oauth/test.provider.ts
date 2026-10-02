import { IdentityProvider } from '../../generated/prisma/enums.js';
import type { AuthorizationParams, ExchangeParams, OAuthProfile, OAuthProvider } from './provider.js';

/**
 * Yalnızca tarayıcı testleri için (OAUTH_TEST_PROVIDER=1, canlıda kapalı). Sağlayıcıya gitmeden
 * doğrudan web'in dönüş adresine yönlendirir; login_hint olarak verilen e-postayla "Google" girişi yapar.
 */
export class TestProvider implements OAuthProvider {
  readonly id = 'test';
  readonly identity = IdentityProvider.GOOGLE;

  authorizationUrl({ redirectUri, state, nonce, loginHint }: AuthorizationParams) {
    const code = Buffer.from(JSON.stringify({ email: loginHint ?? 'test@test.local', nonce })).toString('base64url');
    return `${redirectUri}?${new URLSearchParams({ code, state })}`;
  }

  async exchange({ code, nonce }: ExchangeParams): Promise<OAuthProfile> {
    const data = JSON.parse(Buffer.from(code, 'base64url').toString('utf8')) as { email: string; nonce: string };
    if (data.nonce !== nonce) throw new Error('nonce uyuşmuyor');
    return { subject: `test-${data.email}`, email: data.email, emailVerified: true, name: 'Test Kullanıcı' };
  }
}
