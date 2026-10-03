import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { DomainEvents } from './../src/events/domain-events.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { addApprovedDocuments, markVerified } from './helpers.js';

// Yönetim istatistikleri. Diğer test dosyaları aynı veritabanına paralel yazdığı için toplamlar alt sınırla
// doğrulanır. Çalışan bir MariaDB/MySQL gerektirir.
describe('Yönetim istatistikleri (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let events: DomainEvents;
  const phones = { customer: '+905320001101', company: '+905320001102', admin: '+905320001103' };
  const tokens: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });
  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

  const cleanup = async () => {
    const users = { phone: { in: Object.values(phones) } };
    await prisma.review.deleteMany({ where: { customer: users } });
    await prisma.booking.deleteMany({ where: { request: { customer: users } } });
    await prisma.quote.deleteMany({ where: { request: { customer: users } } });
    await prisma.movingRequest.deleteMany({ where: { customer: users } });
    await prisma.company.deleteMany({ where: { owner: users } });
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.user.deleteMany({ where: users });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    events = app.get(DomainEvents);
    await cleanup();

    for (const who of ['customer', 'company'] as const) {
      const role = who === 'company' ? 'COMPANY' : 'CUSTOMER';
      const res = await http()
        .post('/v1/auth/register')
        .send({ role, fullName: who === 'company' ? 'İstatistik Firma' : 'İstatistik Müşteri', phone: phones[who], password: 'GucluSifre123' })
        .expect(201);
      tokens[who] = res.body.accessToken;
    }
    await markVerified(prisma, Object.values(phones));
    await prisma.user.create({
      data: { role: 'ADMIN', fullName: 'Admin', phone: phones.admin, passwordHash: await bcrypt.hash('GucluSifre123', 4) },
    });
    tokens.admin = (await http().post('/v1/auth/login').send({ phone: phones.admin, password: 'GucluSifre123' }).expect(200)).body.accessToken;

    const companyId = (
      await http()
        .post('/v1/company/profile')
        .set(auth('company'))
        .send({ legalName: 'İstatistik Nakliyat Ltd.', displayName: 'İstatistik Nakliyat', taxNumber: '7777777601', cityCode: '74', serviceCityCodes: ['74'] })
        .expect(201)
    ).body.id;
    await addApprovedDocuments(prisma, [companyId]);
    await http().post(`/v1/admin/companies/${companyId}/verify`).set(auth('admin')).expect(200);

    // Bartın'dan iki talep: ikisine de teklif gelir, biri işe dönüşür
    const requestIds: string[] = [];
    for (const n of [1, 2]) {
      const req = await http()
        .post('/v1/requests')
        .set(auth('customer'))
        .send({
          fromCityCode: '74', fromDistrict: 'merkez', fromAddress: `Sayım Sok. No:${n}`, fromFloor: 1, fromHasElevator: false,
          toCityCode: '74', toDistrict: 'merkez', toAddress: 'Huni Sok. No:2', toFloor: 2, toHasElevator: true,
          homeType: 'TWO_PLUS_ONE', moveDate: inDays(10),
        })
        .expect(201);
      requestIds.push(req.body.id);
    }
    const quoteIds: string[] = [];
    for (const id of requestIds) {
      const quote = await http()
        .post(`/v1/company/requests/${id}/quotes`)
        .set(auth('company'))
        .send({ priceTry: 12000, crewSize: 3, vehicleType: 'KAMYON' })
        .expect(201);
      quoteIds.push(quote.body.id);
    }
    await http().post(`/v1/quotes/${quoteIds[0]}/accept`).set(auth('customer')).expect(200);
    await events.drain();
  });

  afterAll(async () => {
    await events.drain();
    await cleanup();
    await app.close();
  });

  it('yalnızca yönetici görür', async () => {
    await http().get('/v1/admin/stats').expect(401);
    await http().get('/v1/admin/stats').set(auth('customer')).expect(403);
    await http().get('/v1/admin/stats').set(auth('company')).expect(403);
  });

  it('yalnızca 7, 30 ve 90 günlük dönem kabul edilir', async () => {
    await http().get('/v1/admin/stats?days=15').set(auth('admin')).expect(400);
    await http().get('/v1/admin/stats?days=abc').set(auth('admin')).expect(400);
  });

  it('varsayılan dönem 30 gün; huni, ortalamalar ve günlük seri döner', async () => {
    const res = await http().get('/v1/admin/stats').set(auth('admin')).expect(200);
    const body = res.body;
    expect(body.period.days).toBe(30);
    expect(body.daily).toHaveLength(30);
    // Son gün bugün (Türkiye saatiyle)
    const today = new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
    expect(body.daily.at(-1).day).toBe(today);
    expect(body.daily.at(-1).requests).toBeGreaterThanOrEqual(2);
    expect(body.daily.at(-1).quotes).toBeGreaterThanOrEqual(2);
    expect(body.daily.at(-1).bookings).toBeGreaterThanOrEqual(1);

    const { funnel, totals, averages } = body;
    expect(funnel.requests).toBeGreaterThanOrEqual(2);
    expect(funnel.quoted).toBeGreaterThanOrEqual(2);
    expect(funnel.booked).toBeGreaterThanOrEqual(1);
    expect(funnel.requests).toBeGreaterThanOrEqual(funnel.quoted);
    expect(funnel.quoted).toBeGreaterThanOrEqual(funnel.booked);
    expect(funnel.booked).toBeGreaterThanOrEqual(funnel.completed);
    expect(funnel.quotedRate).toBeGreaterThan(0);
    expect(totals.current).toMatchObject({ requests: expect.any(Number), customers: expect.any(Number) });
    expect(totals.current.customers).toBeGreaterThanOrEqual(1);
    expect(totals.current.verifiedCompanies).toBeGreaterThanOrEqual(1);
    expect(totals.previous).toMatchObject({ requests: expect.any(Number), quotes: expect.any(Number) });
    expect(averages.quotesPerRequest).toBeGreaterThan(0);
    expect(Number(averages.acceptedTotalTry)).toBeGreaterThanOrEqual(12000);
    expect(body.ratings.distribution.map((d: { rating: number }) => d.rating)).toEqual([5, 4, 3, 2, 1]);

    const counts = body.cities.map((c: { requests: number }) => c.requests);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    for (const city of body.cities) expect(city.booked).toBeLessThanOrEqual(city.requests);
  });

  it('7 günlük dönemde seri 7 gün; önceki dönem bu dönemden hemen önce biter', async () => {
    const res = await http().get('/v1/admin/stats?days=7').set(auth('admin')).expect(200);
    expect(res.body.daily).toHaveLength(7);
    const { from, previousFrom } = res.body.period;
    expect(new Date(from).getTime() - new Date(previousFrom).getTime()).toBe(7 * 86_400_000);
  });
});
