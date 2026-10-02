import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { DomainEvents } from './../src/events/domain-events.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { EMAIL_CODE_SENDER, PHONE_CODE_SENDER, type CodeSender } from './../src/verification/senders/code-sender.js';

// Çalışan bir MariaDB/MySQL gerektirir (DATABASE_URL).
describe('E-posta ve telefon doğrulaması (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let events: DomainEvents;
  let token: string;
  let requestId: string;
  const phones = ['+905320000701', '+905320000702'];
  const emails = ['dogrulama@test.local', 'baskasi@test.local', 'yeni@test.local'];

  /** Gönderilen kodları yakalayan sahte sağlayıcı */
  const fakeSender = (provider: string) => {
    const sent: { to: string; code: string }[] = [];
    const sender: CodeSender = { provider, send: async (to, code) => void sent.push({ to: to.address, code }) };
    return { sender, sent, last: () => sent.at(-1)! };
  };
  const email = fakeSender('brevo');
  const sms = fakeSender('netgsm');

  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  /** 60 saniyelik bekleme süresini beklemeden geçmek için son kodu eskitir */
  const ageCodes = () =>
    prisma.verificationCode.updateMany({
      where: { user: { phone: phones[0] } },
      data: { createdAt: new Date(Date.now() - 2 * 60_000) },
    });

  const cleanup = async () => {
    const users = { phone: { in: phones } };
    await prisma.movingRequest.deleteMany({ where: { customer: users } });
    await prisma.user.deleteMany({ where: users });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EMAIL_CODE_SENDER)
      .useValue(email.sender)
      .overrideProvider(PHONE_CODE_SENDER)
      .useValue(sms.sender)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    events = app.get(DomainEvents);
    await cleanup();

    await http()
      .post('/v1/auth/register')
      .send({ role: 'CUSTOMER', fullName: 'Başka Kullanıcı', phone: phones[1], email: emails[1], password: 'GucluSifre123' })
      .expect(201);
    const res = await http()
      .post('/v1/auth/register')
      .send({ role: 'CUSTOMER', fullName: 'Doğrulama Deneme', phone: phones[0], email: emails[0], password: 'GucluSifre123' })
      .expect(201);
    token = res.body.accessToken;
    expect(res.body.user).toMatchObject({ emailVerified: false, phoneVerified: false, verified: false });
  });

  afterAll(async () => {
    await events.drain();
    await cleanup();
    await app.close();
  });

  it('kayıtta e-posta kodu gider; kodun kendisi veritabanında saklanmaz', async () => {
    expect(email.last()).toMatchObject({ to: emails[0] });
    expect(email.last().code).toMatch(/^\d{6}$/);
    const stored = await prisma.verificationCode.findFirstOrThrow({ where: { target: emails[0] } });
    expect(stored.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.codeHash).not.toContain(email.last().code);

    const status = await http().get('/v1/auth/verification').set(auth()).expect(200);
    expect(status.body).toMatchObject({
      email: emails[0],
      emailVerified: false,
      emailCodeSentTo: emails[0],
      phoneRequired: true,
      phoneChannel: 'sms',
      phoneCodeSent: false,
      complete: false,
    });
    expect(status.body.emailResendAt).not.toBeNull();
  });

  it('doğrulanmamış hesabın talebi taslak kalır ve firmalara gösterilmez', async () => {
    const res = await http()
      .post('/v1/requests')
      .set(auth())
      .send({
        fromCityCode: '35', fromDistrict: 'konak', fromAddress: 'Alsancak Mah. No:1', fromFloor: 1, fromHasElevator: false,
        toCityCode: '35', toDistrict: 'bornova', toAddress: 'Kazımdirik Mah. No:2', toFloor: 2, toHasElevator: true,
        homeType: 'TWO_PLUS_ONE', moveDate: inDays(12),
      })
      .expect(201);
    expect(res.body.status).toBe('DRAFT');
    requestId = res.body.id;
  });

  it('60 saniye dolmadan yeni kod istenemez', async () => {
    const res = await http().post('/v1/auth/verification/email/send').set(auth()).send({}).expect(429);
    expect(res.body.message).toMatch(/saniye bekle/);
  });

  it('hatalı kod deneme hakkını düşürür; 5 hatada kod geçersiz olur', async () => {
    const wrong = email.last().code === '000000' ? '111111' : '000000';
    const first = await http().post('/v1/auth/verification/email/confirm').set(auth()).send({ code: wrong }).expect(400);
    expect(first.body.message).toBe('Kod hatalı. 4 deneme hakkın kaldı.');
    for (let i = 0; i < 4; i++) {
      await http().post('/v1/auth/verification/email/confirm').set(auth()).send({ code: wrong }).expect(400);
    }
    const locked = await http()
      .post('/v1/auth/verification/email/confirm')
      .set(auth())
      .send({ code: email.last().code })
      .expect(400);
    expect(locked.body.message).toMatch(/Yeni kod iste/);
  });

  it('süresi dolan kod kabul edilmez; yeni kod eskisini geçersiz kılar', async () => {
    await ageCodes();
    await http().post('/v1/auth/verification/email/send').set(auth()).send({}).expect(200);
    const old = email.last().code;
    await prisma.verificationCode.updateMany({
      where: { target: emails[0], consumedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await http().post('/v1/auth/verification/email/confirm').set(auth()).send({ code: old }).expect(400);
  });

  it('başka hesaptaki e-postaya kod gönderilmez; yeni adres onaydan sonra hesaba yazılır', async () => {
    await ageCodes();
    await http().post('/v1/auth/verification/email/send').set(auth()).send({ email: emails[1] }).expect(409);
    const res = await http().post('/v1/auth/verification/email/send').set(auth()).send({ email: ` ${emails[2].toUpperCase()} ` }).expect(200);
    expect(res.body).toMatchObject({ email: emails[0], emailCodeSentTo: emails[2] });
    expect(email.last().to).toBe(emails[2]);

    const ok = await http()
      .post('/v1/auth/verification/email/confirm')
      .set(auth())
      .send({ code: `${email.last().code.slice(0, 3)} ${email.last().code.slice(3)}` })
      .expect(200);
    expect(ok.body).toMatchObject({ email: emails[2], emailVerified: true, complete: false });

    // Kod tek kullanımlık
    await http().post('/v1/auth/verification/email/confirm').set(auth()).send({ code: email.last().code }).expect(400);
    // Telefon henüz doğrulanmadığı için talep hâlâ taslak, teklif kabulü kapalı
    const draft = await http().get(`/v1/requests/${requestId}`).set(auth()).expect(200);
    expect(draft.body.status).toBe('DRAFT');
  });

  it('telefon doğrulanınca hesap tamamlanır ve taslak talep yayına alınır', async () => {
    await http().post('/v1/auth/verification/phone/send').set(auth()).expect(200);
    expect(sms.last().to).toBe(phones[0]);
    const res = await http().post('/v1/auth/verification/phone/confirm').set(auth()).send({ code: sms.last().code }).expect(200);
    expect(res.body).toMatchObject({ phoneVerified: true, complete: true });

    const published = await http().get(`/v1/requests/${requestId}`).set(auth()).expect(200);
    expect(published.body.status).toBe('OPEN');
    const me = await http().get('/v1/auth/me').set(auth()).expect(200);
    expect(me.body).toMatchObject({ emailVerified: true, phoneVerified: true, verified: true });

    await http().post('/v1/auth/verification/phone/send').set(auth()).expect(409);
  });

  it('geçersiz biçimdeki kod reddedilir', async () => {
    await http().post('/v1/auth/verification/email/confirm').set(auth()).send({ code: '12ab56' }).expect(400);
  });
});
