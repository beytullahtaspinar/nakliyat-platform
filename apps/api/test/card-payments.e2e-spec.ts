import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import type { CreditSettings } from './../src/credits/credit-rules.js';
import { CreditsService } from './../src/credits/credits.service.js';
import { DomainEvents } from './../src/events/domain-events.js';
import { CardPaymentsService } from './../src/payments/card-payments.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { markVerified } from './helpers.js';

// Kartla kredi yükleme: iyzico yerine sahte bir sunucu. İstek imzası (IYZWSv2) sahte sunucuda doğrulanır.
// Kart ayarı ortak kayıtta; diğer test dosyaları etkilenmesin diye getSettings üzerine yazılarak açılır.
describe('Kartla ödeme (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mock: Server;
  const phones = { company: '+905320002101', other: '+905320002102', admin: '+905320002103' };
  const tokens: Record<string, string> = {};
  const companyIds: Record<string, string> = {};
  const API_KEY = 'sandbox-test-anahtar';
  const SECRET = 'sandbox-test-gizli';
  let overrides: Partial<CreditSettings> = {};

  /** Sahte iyzico: token → ödeme sonucu; son başlatma isteği */
  const results = new Map<string, Record<string, unknown>>();
  let lastInit: Record<string, unknown> | null = null;
  let badSignatures = 0;
  let tokenSeq = 0;

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });
  const start = (who: 'company' | 'other', amountTry: number, expected = 201) =>
    http().post('/v1/company/credits/card-payments').set(auth(who)).send({ amountTry }).expect(expected);
  const callback = (token: string) => http().post('/v1/payments/iyzico/callback').type('form').send({ token }).expect(303);
  const success = (paymentId: string, price: string, extra: Record<string, unknown> = {}) => ({
    status: 'success',
    paymentStatus: 'SUCCESS',
    paymentId: '24681357',
    price,
    paidPrice: price,
    currency: 'TRY',
    basketId: paymentId,
    fraudStatus: 1,
    ...extra,
  });

  const cleanup = async () => {
    const users = { phone: { in: Object.values(phones) } };
    await prisma.cardPayment.deleteMany({ where: { company: { owner: users } } });
    await prisma.creditTransaction.deleteMany({ where: { company: { owner: users } } });
    await prisma.creditAccount.deleteMany({ where: { company: { owner: users } } });
    await prisma.company.deleteMany({ where: { owner: users } });
    await prisma.notification.deleteMany({ where: { user: users } });
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.user.deleteMany({ where: users });
  };

  beforeAll(async () => {
    mock = createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const rnd = String(req.headers['x-iyzi-rnd'] ?? '');
        const decoded = Buffer.from(String(req.headers.authorization ?? '').replace(/^IYZWSv2 /, ''), 'base64').toString();
        const expected = createHmac('sha256', SECRET).update(rnd + req.url + raw).digest('hex');
        if (decoded !== `apiKey:${API_KEY}&randomKey:${rnd}&signature:${expected}`) {
          badSignatures++;
          res.end(JSON.stringify({ status: 'failure', errorCode: '1001', errorMessage: 'imza hatalı' }));
          return;
        }
        const body = JSON.parse(raw) as Record<string, unknown>;
        if (req.url === '/payment/iyzipos/checkoutform/initialize/auth/ecom') {
          lastInit = body;
          const token = `tok-${++tokenSeq}`;
          res.end(JSON.stringify({ status: 'success', token, paymentPageUrl: `https://sandbox-cpp.iyzipay.com?token=${token}`, tokenExpireTime: 1800 }));
        } else {
          res.end(JSON.stringify(results.get(String(body.token)) ?? { status: 'failure', errorCode: '5059', errorMessage: 'Ödeme bulunamadı' }));
        }
      });
    });
    await new Promise<void>((r) => mock.listen(0, '127.0.0.1', r));
    process.env.IYZICO_API_KEY = API_KEY;
    process.env.IYZICO_SECRET_KEY = SECRET;
    process.env.IYZICO_BASE_URL = `http://127.0.0.1:${(mock.address() as AddressInfo).port}`;
    process.env.WEB_URL = 'http://web.test';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();

    const credits = app.get(CreditsService);
    const real = credits.getSettings.bind(credits);
    vi.spyOn(credits, 'getSettings').mockImplementation(async () => {
      const r = await real();
      return { ...r, settings: { ...r.settings, ...overrides } };
    });

    for (const who of ['company', 'other'] as const) {
      const res = await http()
        .post('/v1/auth/register')
        .send({ role: 'COMPANY', fullName: `Kart Yetkili ${who}`, phone: phones[who], password: 'GucluSifre123', ...(who === 'company' && { email: 'kart-e2e@test.local' }) })
        .expect(201);
      tokens[who] = res.body.accessToken;
    }
    await markVerified(prisma, Object.values(phones));
    for (const [who, tax] of [['company', '5550002101'], ['other', '5550002102']] as const) {
      const res = await http()
        .post('/v1/company/profile')
        .set(auth(who))
        .send({ legalName: `${who} Kart Ltd.`, displayName: `${who} Kart`, taxNumber: tax, cityCode: '35', serviceCityCodes: ['35'] })
        .expect(201);
      companyIds[who] = res.body.id;
    }
    await prisma.user.create({
      data: { role: 'ADMIN', fullName: 'Kart Admin', phone: phones.admin, passwordHash: await bcrypt.hash('GucluSifre123', 4) },
    });
    tokens.admin = (await http().post('/v1/auth/login').send({ phone: phones.admin, password: 'GucluSifre123' }).expect(200)).body.accessToken;
  });

  afterAll(async () => {
    await app.get(DomainEvents).drain();
    await cleanup();
    await app.close();
    await new Promise((r) => mock.close(r));
  });

  beforeEach(() => {
    overrides = { cardEnabled: true, minTopupTry: 100, creditValueTry: 1 };
    lastInit = null;
  });

  it('ayar kapalıyken kart seçeneği görünmez ve ödeme başlatılamaz', async () => {
    overrides = { cardEnabled: false };
    expect((await http().get('/v1/company/credits').set(auth('company')).expect(200)).body.card).toBeNull();
    await start('company', 500, 400);
    const settings = await http().get('/v1/admin/credits/settings').set(auth('admin')).expect(200);
    expect(settings.body.card).toEqual({ configured: true, sandbox: false });
    expect(JSON.stringify(settings.body)).not.toContain(SECRET);
  });

  it('geçersiz tutarı ve e-postasız hesabı reddeder', async () => {
    expect((await http().get('/v1/company/credits').set(auth('company')).expect(200)).body.card).toEqual({ minTry: 100, maxTry: 50000, sandbox: false });
    expect((await start('company', 50, 400)).body.message).toContain('En az 100');
    expect((await start('company', 60000, 400)).body.message).toContain('en fazla');
    expect((await start('other', 500, 400)).body.message).toContain('e-posta');
    expect(lastInit).toBeNull();
  });

  it('başarılı ödeme: imzalı istek, dönüşte iyzico’ya sorulur, kredi bir kez yüklenir, bildirim gider', async () => {
    overrides = { ...overrides, creditValueTry: 0.5 };
    const started = (await start('company', 1000)).body;
    expect(started).toMatchObject({ credits: 2000, amountTry: '1000.00' });
    expect(started.paymentPageUrl).toContain('token=');
    expect(badSignatures).toBe(0);
    expect(lastInit).toMatchObject({
      price: '1000.00',
      paidPrice: '1000.00',
      currency: 'TRY',
      basketId: started.id,
      conversationId: started.id,
      enabledInstallments: [1],
      buyer: { email: 'kart-e2e@test.local', gsmNumber: phones.company, city: 'İzmir', name: 'Kart', surname: 'Yetkili company' },
      basketItems: [{ itemType: 'VIRTUAL', price: '1000.00' }],
    });
    expect(String(lastInit?.callbackUrl)).toMatch(/\/v1\/payments\/iyzico\/callback$/);

    const token = (await prisma.cardPayment.findUniqueOrThrow({ where: { id: started.id } })).token!;
    results.set(token, success(started.id, '1000.0'));
    const res = await callback(token);
    expect(res.headers.location).toBe(`http://web.test/firma-paneli/kredi?odeme=${started.id}#kart`);
    // Aynı dönüş ikinci kez gelirse kredi tekrar yüklenmez
    await callback(token);
    await app.get(CardPaymentsService).reconcile(new Date(Date.now() + 60 * 60_000));

    const own = await http().get(`/v1/company/credits/card-payments/${started.id}`).set(auth('company')).expect(200);
    expect(own.body).toMatchObject({ status: 'SUCCESS', credits: 2000, providerPaymentId: '24681357' });
    await http().get(`/v1/company/credits/card-payments/${started.id}`).set(auth('other')).expect(404);
    expect((await http().get('/v1/company/credits').set(auth('company')).expect(200)).body.balance).toBe(2000);
    const txs = await prisma.creditTransaction.findMany({ where: { companyId: companyIds.company, type: 'CARD_TOPUP' } });
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({ amount: 2000, note: 'Kartla ödeme 1.000,00 TL' });

    await app.get(DomainEvents).drain();
    const note = await prisma.notification.findFirst({ where: { user: { phone: phones.company }, type: 'CREDIT_TOPUP' } });
    expect(note?.title).toBe('Ödemen alındı: 2.000 kredi yüklendi');

    const admin = await http().get('/v1/admin/credits/card-payments').query({ status: 'SUCCESS', q: 'company Kart' }).set(auth('admin')).expect(200);
    expect(admin.body.items[0]).toMatchObject({ id: started.id, company: { id: companyIds.company }, user: { fullName: 'Kart Yetkili company' } });
    expect(admin.body.last30Days.count).toBeGreaterThanOrEqual(1);
  });

  it('tutar ya da sepet uyuşmazsa, ödeme reddedilirse kredi yüklenmez', async () => {
    const before = (await http().get('/v1/company/credits').set(auth('company')).expect(200)).body.balance;

    const a = (await start('company', 500)).body;
    const tokenA = (await prisma.cardPayment.findUniqueOrThrow({ where: { id: a.id } })).token!;
    results.set(tokenA, success(a.id, '1.0'));
    await callback(tokenA);
    expect((await prisma.cardPayment.findUniqueOrThrow({ where: { id: a.id } }))).toMatchObject({ status: 'FAILED', errorMessage: 'Ödenen tutar uyuşmuyor' });

    const b = (await start('company', 500)).body;
    const tokenB = (await prisma.cardPayment.findUniqueOrThrow({ where: { id: b.id } })).token!;
    results.set(tokenB, success('baska-sepet', '500.0'));
    await callback(tokenB);
    expect((await prisma.cardPayment.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('FAILED');

    const c = (await start('company', 500)).body;
    const tokenC = (await prisma.cardPayment.findUniqueOrThrow({ where: { id: c.id } })).token!;
    results.set(tokenC, { status: 'failure', paymentStatus: 'FAILURE', errorMessage: 'Kart limiti yetersiz' });
    await callback(tokenC);
    const failed = await http().get(`/v1/company/credits/card-payments/${c.id}`).set(auth('company')).expect(200);
    expect(failed.body).toMatchObject({ status: 'FAILED', errorMessage: 'Kart limiti yetersiz' });

    // Bilinmeyen token: kredi sayfasına genel uyarıyla döner
    const unknown = await callback('yok-boyle-token');
    expect(unknown.headers.location).toBe('http://web.test/firma-paneli/kredi?odeme=bilinmiyor#kart');
    expect((await http().get('/v1/company/credits').set(auth('company')).expect(200)).body.balance).toBe(before);
  });

  it('dönüşü gelmeyen ödeme: inceleme sürerken bekler, sonra sonradan sorgulanıp yüklenir ya da süresi dolar', async () => {
    const svc = app.get(CardPaymentsService);
    const later = (min: number) => new Date(Date.now() + min * 60_000);

    const review = (await start('company', 300)).body;
    const tokenR = (await prisma.cardPayment.findUniqueOrThrow({ where: { id: review.id } })).token!;
    results.set(tokenR, success(review.id, '300.00', { fraudStatus: 0 }));
    await callback(tokenR);
    expect((await prisma.cardPayment.findUniqueOrThrow({ where: { id: review.id } })).status).toBe('PENDING');
    results.set(tokenR, success(review.id, '300.00'));

    const abandoned = (await start('company', 200)).body;

    await svc.reconcile(later(10));
    expect((await prisma.cardPayment.findUniqueOrThrow({ where: { id: review.id } })).status).toBe('SUCCESS');
    // Form 35 dakikadan yeni: henüz süresi dolmadı
    expect((await prisma.cardPayment.findUniqueOrThrow({ where: { id: abandoned.id } })).status).toBe('PENDING');

    await prisma.cardPayment.update({ where: { id: abandoned.id }, data: { createdAt: new Date(Date.now() - 40 * 60_000) } });
    await svc.reconcile();
    expect((await prisma.cardPayment.findUniqueOrThrow({ where: { id: abandoned.id } }))).toMatchObject({ status: 'EXPIRED', errorMessage: 'Ödeme tamamlanmadı' });
  });

  it('yönetici firma görünümündeyken kartla ödeme başlatılamaz', async () => {
    const imp = await http().post(`/v1/admin/companies/${companyIds.company}/impersonate`).set(auth('admin')).expect(200);
    await http().post('/v1/company/credits/card-payments').set({ Authorization: `Bearer ${imp.body.accessToken}` }).send({ amountTry: 500 }).expect(403);
  });

  it('iyzico form açamazsa ödeme başarısız kaydedilir ve anlaşılır hata döner', async () => {
    const original = process.env.IYZICO_SECRET_KEY;
    // İmza tutmazsa sahte sunucu hata döner
    Object.assign(app.get(CardPaymentsService)['iyzico'], { secretKey: 'yanlis' });
    const res = await start('company', 500, 503);
    expect(res.body.message).toContain('Ödeme formu açılamadı: imza hatalı');
    Object.assign(app.get(CardPaymentsService)['iyzico'], { secretKey: original });
    const last = await prisma.cardPayment.findFirst({ where: { companyId: companyIds.company }, orderBy: { createdAt: 'desc' } });
    expect(last).toMatchObject({ status: 'FAILED', token: null });
  });
});
