import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { IdentityProvider } from './../src/generated/prisma/enums.js';
import { OAUTH_PROVIDERS, type OAuthProfile, type OAuthProvider } from './../src/auth/oauth/provider.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Çalışan bir MariaDB/MySQL gerektirir (DATABASE_URL).
describe('Google / Apple ile giriş (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const phones = ['+905320000801', '+905320000802', '+905320000803'];
  const emails = ['oauth-yeni@test.local', 'oauth-mevcut@test.local', 'oauth-dogrulanmamis@test.local'];

  /** Kodu, testin verdiği profile çeviren sahte Google */
  let nextProfile: OAuthProfile;
  const fakeGoogle: OAuthProvider = {
    id: 'google',
    identity: IdentityProvider.GOOGLE,
    authorizationUrl: ({ redirectUri, state }) => `https://accounts.google.com/auth?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,
    exchange: async ({ code }) => {
      if (code !== 'gecerli-kod') throw new Error('invalid_grant');
      return nextProfile;
    },
  };

  const http = () => request(app.getHttpServer());
  const pkce = { codeVerifier: 'v'.repeat(43), nonce: 'n'.repeat(20) };
  const callback = (code = 'gecerli-kod') => http().post('/v1/auth/oauth/google/callback').send({ code, ...pkce });

  const cleanup = async () => {
    const users = { OR: [{ phone: { in: phones } }, { email: { in: emails } }] };
    await prisma.refreshToken.deleteMany({ where: { user: users } });
    await prisma.user.deleteMany({ where: users });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OAUTH_PROVIDERS)
      .useValue([fakeGoogle])
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('açık sağlayıcılar listelenir; kapalı sağlayıcı reddedilir', async () => {
    expect((await http().get('/v1/auth/oauth/providers').expect(200)).body).toEqual({ providers: ['google'] });
    await http().post('/v1/auth/oauth/apple/start').send({ state: 's'.repeat(20), nonce: 'n'.repeat(20), codeChallenge: 'c'.repeat(43) }).expect(503);
    await http().post('/v1/auth/oauth/bilinmeyen/start').send({ state: 's'.repeat(20), nonce: 'n'.repeat(20), codeChallenge: 'c'.repeat(43) }).expect(404);
  });

  it('dönüş adresi WEB_URL ile kurulur', async () => {
    const res = await http().post('/v1/auth/oauth/google/start').send({ state: 's'.repeat(20), nonce: 'n'.repeat(20), codeChallenge: 'c'.repeat(43) }).expect(200);
    expect(decodeURIComponent(res.body.url)).toMatch(/redirect_uri=.*\/api\/giris\/google\/donus/);
  });

  it('geçersiz kod oturum açmaz', async () => {
    const res = await callback('sahte').expect(401);
    expect(res.body.message).toBe('Google ile giriş yapılamadı, lütfen tekrar dene.');
  });

  it('yeni kişi telefon ve rol girince hesap açılır; e-posta doğrulanmış sayılır', async () => {
    nextProfile = { subject: 'g-yeni', email: emails[0]!, emailVerified: true, name: 'Ayşe Google' };
    const first = await callback().expect(200);
    expect(first.body).toMatchObject({ status: 'signup_required', profile: { fullName: 'Ayşe Google', email: emails[0] } });
    expect(first.body.accessToken).toBeUndefined();

    // Kayıt belirteci erişim anahtarı yerine kullanılamaz
    await http().get('/v1/auth/me').set('Authorization', `Bearer ${first.body.signupToken}`).expect(401);
    const pending = await http().post('/v1/auth/oauth/pending').send({ signupToken: first.body.signupToken }).expect(200);
    expect(pending.body).toMatchObject({ provider: 'GOOGLE', email: emails[0] });

    const done = await http()
      .post('/v1/auth/oauth/complete')
      .send({ signupToken: first.body.signupToken, role: 'CUSTOMER', fullName: 'Ayşe Google', phone: '0532 000 08 01' })
      .expect(200);
    expect(done.body.user).toMatchObject({ phone: phones[0], email: emails[0], emailVerified: true, verified: true });

    // Çift tıklama: aynı belirteç ikinci hesap açmaz
    await http()
      .post('/v1/auth/oauth/complete')
      .send({ signupToken: first.body.signupToken, role: 'CUSTOMER', fullName: 'Ayşe Google', phone: '0532 000 08 01' })
      .expect(200);
    expect(await prisma.user.count({ where: { email: emails[0] } })).toBe(1);

    // Sonraki girişler doğrudan oturum açar; şifreyle giriş yerine düğme önerilir
    const again = await callback().expect(200);
    expect(again.body).toMatchObject({ status: 'signed_in', user: { phone: phones[0] } });
    expect(again.body.accessToken).toEqual(expect.any(String));
    const login = await http().post('/v1/auth/login').send({ phone: phones[0], password: '!' }).expect(401);
    expect(login.body.message).toMatch(/Google veya Apple ile açıldı/);
  });

  it('kayıtlı telefon numarasıyla ikinci hesap açılmaz', async () => {
    nextProfile = { subject: 'g-ikinci', email: null, emailVerified: false, name: null };
    const first = await callback().expect(200);
    await http()
      .post('/v1/auth/oauth/complete')
      .send({ signupToken: first.body.signupToken, role: 'COMPANY', fullName: 'Başka Kişi', phone: phones[0] })
      .expect(409);
  });

  it('e-postası doğrulanmış mevcut hesaba bağlanır; doğrulanmamışa bağlanmaz', async () => {
    const passwordHash = await bcrypt.hash('GucluSifre123', 4);
    await prisma.user.create({
      data: { role: 'CUSTOMER', fullName: 'Mevcut', phone: phones[1]!, email: emails[1], emailVerifiedAt: new Date(), passwordHash },
    });
    await prisma.user.create({ data: { role: 'CUSTOMER', fullName: 'Doğrulanmamış', phone: phones[2]!, email: emails[2], passwordHash } });

    nextProfile = { subject: 'g-mevcut', email: emails[1]!, emailVerified: true, name: 'Mevcut' };
    const linked = await callback().expect(200);
    expect(linked.body).toMatchObject({ status: 'signed_in', user: { phone: phones[1] } });
    // Şifreyle giriş de çalışmaya devam eder
    await http().post('/v1/auth/login').send({ phone: phones[1], password: 'GucluSifre123' }).expect(200);

    nextProfile = { subject: 'g-baskasi', email: emails[2]!, emailVerified: true, name: 'Biri' };
    const refused = await callback().expect(409);
    expect(refused.body.message).toMatch(/Telefon numaran ve şifrenle giriş yap/);
    expect(await prisma.userIdentity.count({ where: { subject: 'g-baskasi' } })).toBe(0);
  });

  it('süresi geçmiş ya da bozuk kayıt belirteci reddedilir', async () => {
    await http().post('/v1/auth/oauth/pending').send({ signupToken: 'bozuk.belirtec.x' }).expect(401);
  });
});
