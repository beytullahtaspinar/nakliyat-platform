import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import type { CreditSettings } from './../src/credits/credit-rules.js';
import { CreditsService } from './../src/credits/credits.service.js';
import { DomainEvents } from './../src/events/domain-events.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { addApprovedDocuments, markVerified } from './helpers.js';

// Kredi defteri: teklifte düşme, iadeler, yönetim ayarları ve elle düzeltme. Çalışan bir MariaDB/MySQL gerektirir.
// Ayarlar tek satırlık ortak kayıt: diğer test dosyaları paralel koştuğu için sistem veritabanında açılmaz,
// bu dosyanın uygulamasında getSettings üzerine yazılarak açılır.
describe('Kredi (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let credits: CreditsService;
  const phones = {
    customer: '+905320001301',
    companyA: '+905320001302',
    companyB: '+905320001303',
    admin: '+905320001304',
  };
  const tokens: Record<string, string> = {};
  const companyIds: Record<string, string> = {};
  const requests: string[] = [];
  let overrides: Partial<CreditSettings> = {};

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });
  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const quoteBody = { priceTry: 20000, crewSize: 3, vehicleType: 'KAMYON' };
  const balanceOf = async (who: 'companyA' | 'companyB') => (await http().get('/v1/company/credits').set(auth(who)).expect(200)).body.balance;

  const cleanup = async () => {
    const users = { phone: { in: Object.values(phones) } };
    await prisma.creditSettings.deleteMany();
    await prisma.creditTransaction.deleteMany({ where: { company: { owner: users } } });
    await prisma.creditAccount.deleteMany({ where: { company: { owner: users } } });
    await prisma.quote.deleteMany({ where: { request: { customer: users } } });
    await prisma.movingRequest.deleteMany({ where: { customer: users } });
    await prisma.company.deleteMany({ where: { owner: users } });
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.user.deleteMany({ where: users });
  };

  const newRequest = async () => {
    const res = await http()
      .post('/v1/requests')
      .set(auth('customer'))
      .send({
        fromCityCode: '34', fromDistrict: 'kadikoy', fromAddress: 'Moda Cad. No:1', fromFloor: 1, fromHasElevator: true,
        toCityCode: '06', toDistrict: 'cankaya', toAddress: 'Atatürk Blv. No:10', toFloor: 1, toHasElevator: true,
        homeType: 'TWO_PLUS_ONE', moveDate: inDays(20),
      })
      .expect(201);
    requests.push(res.body.id);
    return res.body.id as string;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    credits = app.get(CreditsService);
    await cleanup();

    const real = credits.getSettings.bind(credits);
    vi.spyOn(credits, 'getSettings').mockImplementation(async () => {
      const r = await real();
      return { ...r, settings: { ...r.settings, ...overrides } };
    });

    for (const who of ['customer', 'companyA', 'companyB'] as const) {
      const res = await http()
        .post('/v1/auth/register')
        .send({ role: who === 'customer' ? 'CUSTOMER' : 'COMPANY', fullName: `Kredi ${who}`, phone: phones[who], password: 'GucluSifre123' })
        .expect(201);
      tokens[who] = res.body.accessToken;
    }
    await markVerified(prisma, Object.values(phones));
    for (const [who, tax] of [['companyA', '5550001301'], ['companyB', '5550001302']] as const) {
      const res = await http()
        .post('/v1/company/profile')
        .set(auth(who))
        .send({ legalName: `${who} Kredi Ltd.`, displayName: `${who} Kredi`, taxNumber: tax, cityCode: '34', serviceCityCodes: ['34', '06'] })
        .expect(201);
      companyIds[who] = res.body.id;
    }
    await addApprovedDocuments(prisma, Object.values(companyIds));
    await prisma.user.create({
      data: { role: 'ADMIN', fullName: 'Kredi Admin', phone: phones.admin, passwordHash: await bcrypt.hash('GucluSifre123', 4) },
    });
    tokens.admin = (await http().post('/v1/auth/login').send({ phone: phones.admin, password: 'GucluSifre123' }).expect(200)).body.accessToken;
  });

  afterAll(async () => {
    await app.get(DomainEvents).drain();
    await cleanup();
    await app.close();
  });

  it('ayarları yalnızca yönetici değiştirir, geçersiz değeri reddeder, karar geçmişine yazar', async () => {
    await http().get('/v1/admin/credits/settings').set(auth('companyA')).expect(403);
    await http().patch('/v1/admin/credits/settings').set(auth('admin')).send({ quoteCostLocal: 2.5 }).expect(400);
    await http().patch('/v1/admin/credits/settings').set(auth('admin')).send({ expiredRefundPercent: 101 }).expect(400);
    await http().patch('/v1/admin/credits/settings').set(auth('admin')).send({ bilinmeyen: 1 }).expect(400);

    // Sistemi açan alan ortak kayda yazılmaz (paralel testler etkilenmesin); sayısal alan kaydedilir
    const res = await http().patch('/v1/admin/credits/settings').set(auth('admin')).send({ lowBalanceThreshold: 80 }).expect(200);
    expect(res.body.settings).toMatchObject({ enabled: false, lowBalanceThreshold: 80 });
    expect(res.body.defaults.enabled).toBe(false);
    const log = await prisma.auditLog.findFirst({ where: { action: 'credit.settings.update', actor: { phone: phones.admin } } });
    expect(log?.details).toMatchObject({ before: { lowBalanceThreshold: 100 }, after: { lowBalanceThreshold: 80 } });
  });

  it('onaylanan firmaya hoş geldin kredisi bir kez verilir', async () => {
    overrides = { enabled: true, quoteCostLocal: 50, quoteCostIntercity: 100, welcomeCredits: 25 };
    for (const id of Object.values(companyIds)) {
      await http().post(`/v1/admin/companies/${id}/verify`).set(auth('admin')).expect(200);
    }
    // Reddedilip yeniden onaylanan firma ikinci kez almaz
    await http().post(`/v1/admin/companies/${companyIds.companyA}/reject`).set(auth('admin')).send({ reason: 'Deneme reddi' }).expect(200);
    await http().post(`/v1/admin/companies/${companyIds.companyA}/verify`).set(auth('admin')).expect(200);
    expect(await balanceOf('companyA')).toBe(25);
    expect(await balanceOf('companyB')).toBe(25);
    overrides = { ...overrides, welcomeCredits: 0 };
  });

  it('bakiye yetmezse teklif oluşmaz', async () => {
    const id = await newRequest();
    const detail = await http().get(`/v1/company/requests/${id}`).set(auth('companyA')).expect(200);
    expect(detail.body.credit).toEqual({ enabled: true, cost: 100, balance: 25 });

    const res = await http().post(`/v1/company/requests/${id}/quotes`).set(auth('companyA')).send(quoteBody).expect(409);
    expect(res.body.message).toMatch(/yetersiz/);
    expect(await prisma.quote.count({ where: { requestId: id } })).toBe(0);
  });

  it('yönetici gerekçeyle kredi ekler ve düşer; bakiye eksiye düşmez', async () => {
    const url = `/v1/admin/companies/${companyIds.companyA}/credits`;
    await http().post(url).set(auth('companyA')).send({ amount: 100, note: 'Deneme' }).expect(403);
    await http().post(url).set(auth('admin')).send({ amount: 0, note: 'Sıfır' }).expect(400);
    await http().post(url).set(auth('admin')).send({ amount: 100 }).expect(400);
    await http().post(url).set(auth('admin')).send({ amount: 1.5, note: 'Küsurat' }).expect(400);

    const added = await http().post(url).set(auth('admin')).send({ amount: 200, note: 'Pilot firma kredisi' }).expect(201);
    expect(added.body.balance).toBe(225);
    await http().post(url).set(auth('admin')).send({ amount: -1000, note: 'Fazla düşüm' }).expect(409);
    const removed = await http().post(url).set(auth('admin')).send({ amount: -25, note: 'Düzeltme' }).expect(201);
    expect(removed.body.balance).toBe(200);

    const view = await http().get(url).set(auth('admin')).expect(200);
    expect(view.body.balance).toBe(200);
    expect(view.body.recent.items[0]).toMatchObject({ type: 'ADMIN_DEBIT', amount: -25, balanceAfter: 200, note: 'Düzeltme', actor: { fullName: 'Kredi Admin' } });
    expect(await prisma.auditLog.count({ where: { action: 'credit.adjust', entityId: companyIds.companyA } })).toBe(2);
  });

  it('teklif verilince kredi düşer; güncelleme ücretsiz, geri çekmede iade yok', async () => {
    const id = requests[0]!;
    const created = await http().post(`/v1/company/requests/${id}/quotes`).set(auth('companyA')).send(quoteBody).expect(201);
    expect(created.body.creditCost).toBe(100);
    expect(await balanceOf('companyA')).toBe(100);

    await http().patch(`/v1/company/quotes/${created.body.id}`).set(auth('companyA')).send({ priceTry: 18000 }).expect(200);
    expect(await balanceOf('companyA')).toBe(100);

    await http().post(`/v1/company/quotes/${created.body.id}/withdraw`).set(auth('companyA')).expect(200);
    expect(await balanceOf('companyA')).toBe(100);

    const tx = await http().get('/v1/company/credits/transactions?type=QUOTE').set(auth('companyA')).expect(200);
    expect(tx.body.items).toHaveLength(1);
    expect(tx.body.items[0]).toMatchObject({ amount: -100, balanceAfter: 100, request: { id, fromCityName: 'İstanbul', toCityName: 'Ankara' } });
  });

  it('aynı anda iki teklifte bakiye yalnızca birine yeter', async () => {
    await http().post(`/v1/admin/companies/${companyIds.companyB}/credits`).set(auth('admin')).send({ amount: 75, note: 'Eşzamanlılık' }).expect(201);
    const [r1, r2] = [await newRequest(), await newRequest()];
    const results = await Promise.all(
      [r1, r2].map((id) => http().post(`/v1/company/requests/${id}/quotes`).set(auth('companyB')).send(quoteBody)),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await balanceOf('companyB')).toBe(0);
  });

  it('müşteri talebi iptal edince teklif kredisi tam iade edilir, bir kez', async () => {
    // Geri çekilmiş teklif (A, ilk talep) iade almaz
    for (const id of requests) {
      await http().post(`/v1/requests/${id}/cancel`).set(auth('customer')).expect(200);
    }
    expect(await balanceOf('companyB')).toBe(100);
    expect(await balanceOf('companyA')).toBe(100);
    expect(await credits.refundCancelledRequests(requests)).toBe(0);
    const refunds = await prisma.creditTransaction.findMany({ where: { type: 'QUOTE_REFUND', companyId: companyIds.companyB } });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ amount: 100, balanceAfter: 100, note: 'Talep iptal edildi' });
  });

  it('seçim yapılmadan süresi dolan talepte ayardaki oran kadar iade', async () => {
    const id = await newRequest();
    await http().post(`/v1/company/requests/${id}/quotes`).set(auth('companyA')).send(quoteBody).expect(201);
    expect(await balanceOf('companyA')).toBe(0);
    await prisma.movingRequest.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 3_600_000) } });

    overrides = { ...overrides, expiredRefundPercent: 0 };
    expect(await credits.refundExpired()).toBe(0);
    overrides = { ...overrides, expiredRefundPercent: 50 };
    expect(await credits.refundExpired()).toBe(1);
    expect(await credits.refundExpired()).toBe(0);
    expect(await balanceOf('companyA')).toBe(50);
  });

  it('firma paneli özeti ve yönetim panosu', async () => {
    const summary = await http().get('/v1/company/credits').set(auth('companyA')).expect(200);
    expect(summary.body).toMatchObject({ enabled: true, balance: 50, quoteCostLocal: 50, quoteCostIntercity: 100, lowBalanceThreshold: 80 });
    await http().get('/v1/admin/credits/overview').set(auth('companyA')).expect(403);

    const overview = await http().get('/v1/admin/credits/overview').set(auth('admin')).expect(200);
    expect(overview.body.totalBalance).toBeGreaterThanOrEqual(150);
    expect(overview.body.month.QUOTE.amount).toBeLessThanOrEqual(-300);
    expect(overview.body.month.WELCOME.count).toBeGreaterThanOrEqual(2);

    const list = await http().get(`/v1/admin/credits/transactions?companyId=${companyIds.companyA}`).set(auth('admin')).expect(200);
    const ledger = await prisma.creditTransaction.aggregate({ where: { companyId: companyIds.companyA }, _sum: { amount: true } });
    expect(ledger._sum.amount).toBe(50);
    expect(list.body.total).toBe(6);
    expect(list.body.items[0]).toMatchObject({ type: 'QUOTE_REFUND', amount: 50, company: { displayName: 'companyA Kredi' } });
    const byName = await http().get('/v1/admin/credits/transactions?q=companyB%20Kredi&type=QUOTE').set(auth('admin')).expect(200);
    expect(byName.body.total).toBe(1);
  });
});
