import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { EMAIL_CODE_SENDER, type CodePurpose, type CodeSender } from './../src/verification/senders/code-sender.js';

// Çalışan bir MariaDB/MySQL gerektirir (DATABASE_URL).
describe('Şifremi unuttum (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const phone = '+905320000801';
  const address = 'sifre@test.local';

  const sent: { to: string; code: string; purpose?: CodePurpose }[] = [];
  const sender: CodeSender = {
    provider: 'brevo',
    send: async (to, code, purpose) => void sent.push({ to: to.address, code, purpose }),
  };
  const last = () => sent.at(-1)!;

  const http = () => request(app.getHttpServer());
  const login = (password: string) => http().post('/v1/auth/login').send({ phone, password });
  /** 60 saniyelik bekleme süresini beklemeden geçmek için kodları eskitir */
  const ageCodes = () =>
    prisma.verificationCode.updateMany({
      where: { user: { phone } },
      data: { createdAt: new Date(Date.now() - 2 * 60_000) },
    });
  const audit = (action: string) => prisma.auditLog.count({ where: { action, actor: { phone } } });

  const cleanup = async () => {
    await prisma.auditLog.deleteMany({ where: { actor: { phone } } });
    await prisma.user.deleteMany({ where: { phone } });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EMAIL_CODE_SENDER)
      .useValue(sender)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
    await http()
      .post('/v1/auth/register')
      .send({ role: 'CUSTOMER', fullName: 'Şifre Unutan', phone, email: address, password: 'EskiSifre123' })
      .expect(201);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('kayıtlı olmayan adres için de aynı yanıt döner, kod gitmez', async () => {
    const before = sent.length;
    await http().post('/v1/auth/forgot-password').send({ email: 'yok@test.local' }).expect(204);
    expect(sent.length).toBe(before);
  });

  it('kayıtlı adrese şifre sıfırlama kodu gider; doğrulama kodunu geçersiz kılmaz', async () => {
    await http().post('/v1/auth/forgot-password').send({ email: ' Sifre@Test.local ' }).expect(204);
    expect(last()).toMatchObject({ to: address, purpose: 'password-reset' });
    const codes = await prisma.verificationCode.findMany({ where: { user: { phone } } });
    const reset = codes.find((c) => c.channel === 'PASSWORD_RESET')!;
    // 15 dakika geçerli
    expect(reset.expiresAt.getTime() - reset.createdAt.getTime()).toBeCloseTo(15 * 60_000, -3);
    // Kayıtta giden e-posta doğrulama kodu hâlâ kullanılabilir
    expect(codes.find((c) => c.channel === 'EMAIL')!.consumedAt).toBeNull();
    expect(await audit('password_reset.request')).toBe(1);
  });

  it('60 saniye dolmadan tekrar istenirse sessizce yeni kod gönderilmez', async () => {
    const before = sent.length;
    await http().post('/v1/auth/forgot-password').send({ email: address }).expect(204);
    expect(sent.length).toBe(before);
  });

  it('hatalı kod deneme hakkını düşürür, şifre değişmez', async () => {
    const wrong = last().code === '000000' ? '111111' : '000000';
    const res = await http()
      .post('/v1/auth/reset-password')
      .send({ email: address, code: wrong, password: 'YeniSifre123' })
      .expect(400);
    expect(res.body.message).toBe('Kod hatalı. 4 deneme hakkın kaldı.');
    await login('EskiSifre123').expect(200);
  });

  it('kısa şifre reddedilir', async () => {
    await http().post('/v1/auth/reset-password').send({ email: address, code: last().code, password: 'kisa' }).expect(400);
  });

  it('doğru kodla şifre değişir, açık oturumlar kapanır, e-posta doğrulanmış sayılır', async () => {
    const session = await login('EskiSifre123').expect(200);
    await http()
      .post('/v1/auth/reset-password')
      .send({ email: address, code: last().code, password: 'YeniSifre123' })
      .expect(204);

    await login('EskiSifre123').expect(401);
    await login('YeniSifre123').expect(200);
    await http().post('/v1/auth/refresh').send({ refreshToken: session.body.refreshToken }).expect(401);
    const user = await prisma.user.findUniqueOrThrow({ where: { phone } });
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(await audit('password_reset.complete')).toBe(1);
  });

  it('kullanılmış kod ikinci kez kullanılamaz', async () => {
    const res = await http()
      .post('/v1/auth/reset-password')
      .send({ email: address, code: last().code, password: 'BaskaSifre123' })
      .expect(400);
    expect(res.body.message).toMatch(/Yeni kod iste/);
  });

  it('süresi dolan kod kabul edilmez', async () => {
    await ageCodes();
    await http().post('/v1/auth/forgot-password').send({ email: address }).expect(204);
    await prisma.verificationCode.updateMany({
      where: { user: { phone }, channel: 'PASSWORD_RESET', consumedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await http()
      .post('/v1/auth/reset-password')
      .send({ email: address, code: last().code, password: 'BaskaSifre123' })
      .expect(400);
    expect(res.body.message).toBe('Kodun süresi dolmuş. Yeni kod iste.');
  });

  it('başka adresle kod denenemez', async () => {
    await ageCodes();
    await http().post('/v1/auth/forgot-password').send({ email: address }).expect(204);
    await http()
      .post('/v1/auth/reset-password')
      .send({ email: 'yok@test.local', code: last().code, password: 'BaskaSifre123' })
      .expect(400);
    await login('YeniSifre123').expect(200);
  });
});
