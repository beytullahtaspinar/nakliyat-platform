import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { DomainEvents } from './../src/events/domain-events.js';
import { todayInTurkey } from './../src/media/company-document-rules.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { addApprovedDocuments, markVerified } from './helpers.js';

// Firma paneli CRM uçları: süzgeçler, iş ayrıntısı, müşteriler ve pano. Çalışan bir MariaDB/MySQL gerektirir.
describe('Firma paneli listeleri ve pano (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let events: DomainEvents;
  const phones = { ayse: '+905320001801', mehmet: '+905320001802', company: '+905320001803', other: '+905320001804' };
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });
  const today = todayInTurkey();
  const addDays = (day: string, days: number) =>
    new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

  const cleanup = async () => {
    const users = { phone: { in: Object.values(phones) } };
    await prisma.notification.deleteMany({ where: { user: users } });
    await prisma.booking.deleteMany({ where: { request: { customer: users } } });
    await prisma.quote.deleteMany({ where: { request: { customer: users } } });
    await prisma.movingRequest.deleteMany({ where: { customer: users } });
    await prisma.companyDocument.deleteMany({ where: { company: { owner: users } } });
    await prisma.company.deleteMany({ where: { owner: users } });
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.user.deleteMany({ where: users });
  };

  const openRequest = async (customer: 'ayse' | 'mehmet', toCityCode: string, toDistrict: string, moveDate: string) => {
    const res = await http()
      .post('/v1/requests')
      .set(auth(customer))
      .send({
        fromCityCode: '16', fromDistrict: 'nilufer', fromAddress: 'CRM Sok. No:1', fromFloor: 1, fromHasElevator: false,
        toCityCode, toDistrict, toAddress: 'CRM Sok. No:2', toFloor: 2, toHasElevator: true,
        homeType: 'TWO_PLUS_ONE', moveDate,
      })
      .expect(201);
    return res.body.id as string;
  };
  const quote = async (requestId: string, priceTry: number) => {
    const res = await http()
      .post(`/v1/company/requests/${requestId}/quotes`)
      .set(auth('company'))
      .send({ priceTry, crewSize: 3, vehicleType: 'KAMYON' })
      .expect(201);
    return res.body.id as string;
  };
  const accept = (customer: 'ayse' | 'mehmet', quoteId: string) =>
    http().post(`/v1/quotes/${quoteId}/accept`).set(auth(customer)).expect(200);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    events = app.get(DomainEvents);
    await cleanup();

    const names = { ayse: 'Ayşe CRM', mehmet: 'Mehmet CRM', company: 'CRM Firma', other: 'CRM Diğer' };
    for (const who of Object.keys(phones) as (keyof typeof phones)[]) {
      const res = await http()
        .post('/v1/auth/register')
        .send({ role: who === 'ayse' || who === 'mehmet' ? 'CUSTOMER' : 'COMPANY', fullName: names[who], phone: phones[who], password: 'GucluSifre123' })
        .expect(201);
      tokens[who] = res.body.accessToken;
    }
    await markVerified(prisma, Object.values(phones));
    for (const [who, tax] of [['company', '7777771803'], ['other', '7777771804']] as const) {
      const profile = await http()
        .post('/v1/company/profile')
        .set(auth(who))
        .send({ legalName: `${names[who]} Ltd.`, displayName: names[who], taxNumber: tax, cityCode: '16', serviceCityCodes: ['16', '06'] })
        .expect(201);
      await addApprovedDocuments(prisma, [profile.body.id]);
      await prisma.company.update({ where: { id: profile.body.id }, data: { verificationStatus: 'VERIFIED' } });
    }

    // Ayşe: iki iş (biri iptal), Mehmet: bir iş; bir talep teklifsiz, biri bekleyen teklifli
    ids.ayse1 = await openRequest('ayse', '06', 'cankaya', addDays(today, 3));
    ids.ayse2 = await openRequest('ayse', '16', 'osmangazi', addDays(today, 20));
    ids.mehmet = await openRequest('mehmet', '06', 'cankaya', addDays(today, 10));
    ids.pending = await openRequest('mehmet', '16', 'osmangazi', addDays(today, 12));
    ids.fresh = await openRequest('ayse', '06', 'cankaya', addDays(today, 14));
    await accept('ayse', await quote(ids.ayse1, 10000));
    await accept('ayse', await quote(ids.ayse2, 5000));
    await accept('mehmet', await quote(ids.mehmet, 8000));
    await quote(ids.pending, 7000);
    const cancelled = await prisma.booking.findUniqueOrThrow({ where: { requestId: ids.ayse2 } });
    await prisma.booking.update({ where: { id: cancelled.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    ids.cancelledBooking = cancelled.id;
    await events.drain();
  });

  afterAll(async () => {
    await events.drain();
    await cleanup();
    await app.close();
  });

  it('gelen talepleri teklif durumu ve ile göre süzer', async () => {
    const mine = (res: request.Response) => (res.body.items as { id: string }[]).map((r) => r.id).filter((id) => [ids.pending, ids.fresh].includes(id));
    const notQuoted = await http().get('/v1/company/requests?quoted=no&limit=50').set(auth('company')).expect(200);
    expect(mine(notQuoted)).toEqual([ids.fresh]);
    const quoted = await http().get('/v1/company/requests?quoted=yes&limit=50').set(auth('company')).expect(200);
    expect(mine(quoted)).toEqual([ids.pending]);
    const ankara = await http().get('/v1/company/requests?city=06&limit=50').set(auth('company')).expect(200);
    expect(mine(ankara)).toEqual([ids.fresh]);
    await http().get('/v1/company/requests?city=ankara').set(auth('company')).expect(400);
  });

  it('teklifleri duruma göre süzer', async () => {
    const pending = await http().get('/v1/company/quotes?status=PENDING').set(auth('company')).expect(200);
    expect(pending.body.items.map((q: { requestId: string }) => q.requestId)).toEqual([ids.pending]);
    const accepted = await http().get('/v1/company/quotes?status=ACCEPTED').set(auth('company')).expect(200);
    expect(accepted.body.total).toBe(3);
  });

  it('işleri duruma ve müşteriye göre süzer, tek işi getirir', async () => {
    const scheduled = await http().get('/v1/company/bookings?status=SCHEDULED').set(auth('company')).expect(200);
    expect(scheduled.body.items.map((b: { customer: { fullName: string } }) => b.customer.fullName)).toEqual(['Ayşe CRM', 'Mehmet CRM']);
    const byName = await http().get('/v1/company/bookings?q=mehmet').set(auth('company')).expect(200);
    expect(byName.body.total).toBe(1);
    const byPhone = await http()
      .get(`/v1/company/bookings?q=${encodeURIComponent('0532 000 18 01')}`)
      .set(auth('company'))
      .expect(200);
    expect(byPhone.body.total).toBe(2);

    const one = await http().get(`/v1/company/bookings/${ids.cancelledBooking}`).set(auth('company')).expect(200);
    expect(one.body).toMatchObject({ status: 'CANCELLED', customer: { fullName: 'Ayşe CRM' }, priceTry: '5000' });
    expect(one.body.request.to.address).toBe('CRM Sok. No:2');
    // Başka firmanın işi görünmez
    await http().get(`/v1/company/bookings/${ids.cancelledBooking}`).set(auth('other')).expect(404);
  });

  it('müşterileri iş sayısı ve tutarla listeler', async () => {
    const res = await http().get('/v1/company/customers').set(auth('company')).expect(200);
    expect(res.body.total).toBe(2);
    const ayse = res.body.items.find((c: { fullName: string }) => c.fullName === 'Ayşe CRM');
    expect(ayse).toMatchObject({ phone: phones.ayse, bookingCount: 2, activeCount: 1, totalTry: 10000 });
    expect(ayse.lastBooking).toMatchObject({ id: ids.cancelledBooking, status: 'CANCELLED', to: { cityName: 'Bursa' } });
    const search = await http().get('/v1/company/customers?q=Mehmet').set(auth('company')).expect(200);
    expect(search.body.items).toHaveLength(1);
    await http().get('/v1/company/customers').set(auth('ayse')).expect(403);
  });

  it('pano özetini verir', async () => {
    const res = await http().get('/v1/company/overview').set(auth('company')).expect(200);
    expect(res.body.requests.notQuoted).toBeGreaterThanOrEqual(1);
    expect(res.body.quotes).toMatchObject({ pending: 1, accepted: 3, winRate: 1 });
    expect(res.body.bookings).toMatchObject({ scheduled: 2, next7Days: 1, completed: 0, cancelled: 1 });
    expect(res.body.revenue.month).toBe(today.slice(0, 7));
    // İptal edilen iş ciroya girmez; işler bu ay ya da gelecek ayda olabilir
    expect(res.body.revenue.thisMonthTry + 0).toBeLessThanOrEqual(18000);
    expect(res.body.rating).toEqual({ average: 0, count: 0 });
  });
});
