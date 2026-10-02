import { createVerify, generateKeyPairSync, sign } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { AppleProvider } from './apple.provider.js';
import { GoogleProvider } from './google.provider.js';
import { clearJwksCache, verifyIdToken } from './id-token.js';
import { createOAuthProviders } from './index.js';

const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...rsa.publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const p8 = ec.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
function idToken(claims: Record<string, unknown>, kid = 'k1') {
  const data = `${b64({ alg: 'RS256', kid })}.${b64(claims)}`;
  return `${data}.${sign('sha256', Buffer.from(data), rsa.privateKey).toString('base64url')}`;
}
const now = () => Math.floor(Date.now() / 1000);
const googleClaims = (extra: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com',
  aud: 'google-id',
  sub: '1234567890',
  exp: now() + 600,
  nonce: 'n'.repeat(20),
  email: 'Ayse@Gmail.com',
  email_verified: true,
  name: 'Ayşe Yılmaz',
  ...extra,
});

/** Token ucu id_token döner, JWKS ucu test anahtarını */
function stubProvider(token: string) {
  const fetchMock = vi.fn(async (url: string) =>
    url.includes('token')
      ? new Response(JSON.stringify({ id_token: token }), { status: 200 })
      : new Response(JSON.stringify({ keys: [jwk] }), { status: 200 }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('Google / Apple girişi', () => {
  beforeEach(() => clearJwksCache());
  afterEach(() => vi.unstubAllGlobals());

  const google = new GoogleProvider({ clientId: 'google-id', clientSecret: 'gizli' });
  const exchange = { code: 'kod', redirectUri: 'https://evdenevenakliyat.app/api/giris/google/donus', codeVerifier: 'v'.repeat(43), nonce: 'n'.repeat(20) };

  it('Google yetki adresi PKCE ve nonce içerir', () => {
    const url = new URL(google.authorizationUrl({ redirectUri: exchange.redirectUri, state: 's'.repeat(20), nonce: 'n'.repeat(20), codeChallenge: 'c'.repeat(43) }));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('redirect_uri')).toBe(exchange.redirectUri);
  });

  it('Google kodu id_token ile değiştirir, imzayı ve alanları doğrular', async () => {
    const fetchMock = stubProvider(idToken(googleClaims()));
    await expect(google.exchange(exchange)).resolves.toEqual({
      subject: '1234567890',
      email: 'ayse@gmail.com',
      emailVerified: true,
      name: 'Ayşe Yılmaz',
    });
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    const body = new URLSearchParams(init.body as string);
    expect(body.get('code_verifier')).toBe('v'.repeat(43));
    expect(body.get('client_secret')).toBe('gizli');
  });

  it.each([
    ['başka uygulamaya verilmiş', { aud: 'baska-id' }],
    ['süresi dolmuş', { exp: now() - 3600 }],
    ['farklı nonce', { nonce: 'x'.repeat(20) }],
    ['farklı yayıncı', { iss: 'https://kotu.example' }],
  ])('id_token reddedilir: %s', async (_name, extra) => {
    stubProvider(idToken(googleClaims(extra)));
    await expect(google.exchange(exchange)).rejects.toThrow();
  });

  it('başka anahtarla imzalanmış id_token reddedilir', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const data = `${b64({ alg: 'RS256', kid: 'k1' })}.${b64(googleClaims())}`;
    const forged = `${data}.${sign('sha256', Buffer.from(data), other.privateKey).toString('base64url')}`;
    stubProvider(forged);
    await expect(
      verifyIdToken(forged, { jwksUrl: 'https://jwks', issuers: ['https://accounts.google.com'], audience: 'google-id', nonce: 'n'.repeat(20) }),
    ).rejects.toThrow('imzası geçersiz');
  });

  it('Apple: form_post ile döner, client_secret ES256 ile imzalı, ad ilk girişte formdan alınır', async () => {
    const apple = new AppleProvider({ clientId: 'app.evdenevenakliyat.giris', teamId: 'TEAM123456', keyId: 'KEY1234567', privateKey: p8.replace(/\n/g, '\\n') });
    const url = new URL(apple.authorizationUrl({ redirectUri: 'https://x/donus', state: 's'.repeat(20), nonce: 'n'.repeat(20), codeChallenge: 'c'.repeat(43) }));
    expect(url.searchParams.get('response_mode')).toBe('form_post');
    expect(url.searchParams.get('scope')).toBe('name email');

    const secret = apple.clientSecret();
    const [h, p, s] = secret.split('.') as [string, string, string];
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toMatchObject({ alg: 'ES256', kid: 'KEY1234567' });
    expect(JSON.parse(Buffer.from(p, 'base64url').toString())).toMatchObject({ iss: 'TEAM123456', aud: 'https://appleid.apple.com', sub: 'app.evdenevenakliyat.giris' });
    const ok = createVerify('sha256').update(`${h}.${p}`).verify({ key: ec.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'));
    expect(ok).toBe(true);

    stubProvider(idToken({ iss: 'https://appleid.apple.com', aud: 'app.evdenevenakliyat.giris', sub: '001.abc', exp: now() + 600, nonce: 'n'.repeat(20), email: 'x@privaterelay.appleid.com', email_verified: 'true' }));
    await expect(
      apple.exchange({ ...exchange, appleUser: JSON.stringify({ name: { firstName: 'Ayşe', lastName: 'Yılmaz' } }) }),
    ).resolves.toEqual({ subject: '001.abc', email: 'x@privaterelay.appleid.com', emailVerified: true, name: 'Ayşe Yılmaz' });
  });

  it('anahtarı eksik sağlayıcı açılmaz; test sağlayıcısı canlıda kapalı', () => {
    expect(createOAuthProviders(new ConfigService({}))).toEqual([]);
    expect(createOAuthProviders(new ConfigService({ GOOGLE_CLIENT_ID: 'x' }))).toEqual([]);
    expect(createOAuthProviders(new ConfigService({ APPLE_CLIENT_ID: 'x', APPLE_TEAM_ID: 't', APPLE_KEY_ID: 'k', APPLE_PRIVATE_KEY: 'bozuk' }))).toEqual([]);
    expect(createOAuthProviders(new ConfigService({ GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'y' })).map((p) => p.id)).toEqual(['google']);
    expect(createOAuthProviders(new ConfigService({ OAUTH_TEST_PROVIDER: '1', NODE_ENV: 'production' }))).toEqual([]);
    expect(createOAuthProviders(new ConfigService({ OAUTH_TEST_PROVIDER: '1' })).map((p) => p.id)).toEqual(['test']);
  });
});
