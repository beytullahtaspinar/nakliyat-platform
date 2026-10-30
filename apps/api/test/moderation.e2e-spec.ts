import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { DomainEvents } from './../src/events/domain-events.js';
import { NOTIFICATION_CHANNELS } from './../src/notifications/channels/channel.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { addApprovedDocuments, markVerified, retryOnConflict } from './helpers.js';

// Mağaza kuralları için kullanıcı içeriği denetimi: küfür süzgeci, bildirme ve engelleme. MariaDB/MySQL gerektirir.
describe('İçerik bildirimi ve engelleme (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let events: DomainEvents;
  const phones = {
    customer: '+905320000901',
    company: '+905320000902',
    other: '+905320000903',
    admin: '+905320000904',
  };
  const tokens: Record<string, string> = {};
  let ids: Record<string, string> = {};
  let bookingId: string;
  let companyMessageId: string;
  let reviewId: string;

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });
  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

  const cleanup = async () => {
    const users = { phone: { in: Object.values(phones) } };
    const userIds = (await prisma.user.findMany({ where: users, select: { id: true } })).map((u) => u.id);
    await prisma.contentReport.deleteMany({ where: { reporterId: { in: userIds } } });
    await prisma.messagingBlock.deleteMany({ where: { customerId: { in: userIds } } });
    await prisma.message.deleteMany({ where: { sender: users } });
    await prisma.review.deleteMany({ where: { customer: users } });
    await prisma.booking.deleteMany({ where: { request: { customer: users } } });
    await prisma.creditTransaction.deleteMany({ where: { company: { owner: users } } });
    await prisma.quote.deleteMany({ where: { request: { customer: users } } });
    await prisma.movingRequest.deleteMany({ where: { customer: users } });
    await prisma.companyDocument.deleteMany({ where: { company: { owner: users } } });
    await prisma.company.deleteMany({ where: { owner: users } });
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.user.deleteMany({ where: users });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(NOTIFICATION_CHANNELS)
      .useValue([])
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    events = app.get(DomainEvents);
    await retryOnConflict(cleanup);

    for (const who of ['customer', 'company', 'other'] as const) {
      const res = await http()
        .post('/v1/auth/register')
        .send({ role: who === 'company' ? 'COMPANY' : 'CUSTOMER', fullName: `Denetim ${who}`, phone: phones[who], password: 'GucluSifre123' })
        .expect(201);
      tokens[who] = res.body.accessToken;
    }
    await markVerified(prisma, Object.values(phones));
    await prisma.user.create({
      data: { role: 'ADMIN', fullName: 'Admin', phone: phones.admin, passwordHash: await bcrypt.hash('GucluSifre123', 4) },
    });
    tokens.admin = (await http().post('/v1/auth/login').send({ phone: phones.admin, password: 'GucluSifre123' }).expect(200)).body.accessToken;
    ids = Object.fromEntries(
      (await prisma.user.findMany({ where: { phone: { in: Object.values(phones) } } })).map((u) => [
        Object.entries(phones).find(([, p]) => p === u.phone)![0],
        u.id,
      ]),
    );

    const profile = await http()
      .post('/v1/company/profile')
      .set(auth('company'))
      .send({ legalName: 'Denetim Nakliyat Ltd.', displayName: 'Denetim Nakliyat', taxNumber: '7777777901', cityCode: '35', serviceCityCodes: ['35'] })
      .expect(201);
    await addApprovedDocuments(prisma, [profile.body.id]);
    await http().post(`/v1/admin/companies/${profile.body.id}/verify`).set(auth('admin')).expect(200);

    const req = await http()
      .post('/v1/requests')
      .set(auth('customer'))
      .send({
        fromCityCode: '35', fromDistrict: 'karsiyaka', fromAddress: 'Denetim Sok. No:1', fromFloor: 1, fromHasElevator: false,
        toCityCode: '35', toDistrict: 'bornova', toAddress: 'Denetim Sok. No:2', toFloor: 2, toHasElevator: true,
        homeType: 'TWO_PLUS_ONE', moveDate: inDays(10),
      })
      .expect(201);
    const quote = await http()
      .post(`/v1/company/requests/${req.body.id}/quotes`)
      .set(auth('company'))
      .send({ priceTry: 9000, crewSize: 2, vehicleType: 'KAMYONET' })
      .expect(201);
    bookingId = (await http().post(`/v1/quotes/${quote.body.id}/accept`).set(auth('customer')).expect(200)).body.booking.id;
    await events.drain();
  });

  afterAll(async () => {
    await events.drain();
    await retryOnConflict(cleanup);
    await app.close();
  });

  it('küfürlü mesaj gönderilmez', async () => {
    const res = await http().post(`/v1/bookings/${bookingId}/messages`).set(auth('company')).send({ body: 'Siktir git' }).expect(400);
    expect(JSON.stringify(res.body)).toContain('uygunsuz');
    companyMessageId = (
      await http().post(`/v1/bookings/${bookingId}/messages`).set(auth('company')).send({ body: 'Fiyatı şimdi iki katına çıkardık.' }).expect(201)
    ).body.id;
    await events.drain();
  });

  it('karşı tarafın mesajı bildirilir; kendi mesajı ve başkasının işi bildirilemez', async () => {
    const report = { target: 'MESSAGE', targetId: companyMessageId, reason: 'FRAUD', note: 'Anlaşılan fiyatı değiştiriyor' };
    const first = await http().post('/v1/reports').set(auth('customer')).send(report).expect(201);
    expect(first.body.status).toBe('OPEN');
    // İkinci dokunuş yeni kayıt açmaz
    const again = await http().post('/v1/reports').set(auth('customer')).send(report).expect(201);
    expect(again.body.id).toBe(first.body.id);

    await http().post('/v1/reports').set(auth('company')).send(report).expect(400);
    await http().post('/v1/reports').set(auth('other')).send(report).expect(404);
    await http().post('/v1/reports').set(auth('customer')).send({ ...report, reason: 'BILINMEYEN' }).expect(400);
  });

  it('müşteri firmayı engelleyince iki taraf da yazamaz; engeli yalnız koyan kaldırır', async () => {
    const blocked = await http().post(`/v1/bookings/${bookingId}/block`).set(auth('customer')).expect(200);
    expect(blocked.body).toMatchObject({ canSend: false, blocked: { byMe: true, byThem: false } });

    const companyView = await http().get(`/v1/bookings/${bookingId}/messages`).set(auth('company')).expect(200);
    expect(companyView.body).toMatchObject({ canSend: false, blocked: { byMe: false, byThem: true } });
    await http().post(`/v1/bookings/${bookingId}/messages`).set(auth('company')).send({ body: 'Merhaba?' }).expect(409);
    await http().post(`/v1/bookings/${bookingId}/messages`).set(auth('customer')).send({ body: 'Merhaba' }).expect(409);

    // Firma kendi koymadığı engeli kaldıramaz
    await http().delete(`/v1/bookings/${bookingId}/block`).set(auth('company')).expect(200);
    expect((await http().get(`/v1/bookings/${bookingId}/messages`).set(auth('customer')).expect(200)).body.canSend).toBe(false);

    const unblocked = await http().delete(`/v1/bookings/${bookingId}/block`).set(auth('customer')).expect(200);
    expect(unblocked.body).toMatchObject({ canSend: true, blocked: { byMe: false, byThem: false } });
    await http().post(`/v1/bookings/${bookingId}/block`).set(auth('other')).expect(404);
  });

  it('firma yorumu, müşteri firmanın yanıtını bildirir', async () => {
    await prisma.booking.update({ where: { id: bookingId }, data: { status: 'COMPLETED', completedAt: new Date() } });
    const companyId = (await prisma.company.findFirstOrThrow({ where: { ownerId: ids.company } })).id;
    reviewId = (
      await prisma.review.create({
        data: { bookingId, companyId, customerId: ids.customer, rating: 1, comment: 'Eşyalarımızı kırdılar, hiç özen göstermediler.' },
      })
    ).id;
    await http()
      .post(`/v1/company/reviews/${reviewId}/reply`)
      .set(auth('company'))
      .send({ body: 'Sen tam bir şerefsizsin' })
      .expect(400);
    await http()
      .post(`/v1/company/reviews/${reviewId}/reply`)
      .set(auth('company'))
      .send({ body: 'Bu müşteri yalan söylüyor, hiçbir şey kırılmadı.' })
      .expect(200);

    await http().post('/v1/reports').set(auth('company')).send({ target: 'REVIEW', targetId: reviewId, reason: 'OTHER' }).expect(201);
    await http().post('/v1/reports').set(auth('customer')).send({ target: 'REVIEW_REPLY', targetId: reviewId, reason: 'ABUSE' }).expect(201);
    // Yorumu yalnız firma, yanıtı yalnız müşteri bildirebilir
    await http().post('/v1/reports').set(auth('customer')).send({ target: 'REVIEW', targetId: reviewId, reason: 'OTHER' }).expect(404);
    await http().post('/v1/reports').set(auth('other')).send({ target: 'REVIEW_REPLY', targetId: reviewId, reason: 'ABUSE' }).expect(404);
  });

  it('yönetici bildirimleri görür; içeriği kaldırarak kapatır', async () => {
    await http().get('/v1/admin/reports').set(auth('customer')).expect(403);
    const summary = await http().get('/v1/admin/summary').set(auth('admin')).expect(200);
    expect(summary.body.reports.open).toBeGreaterThanOrEqual(3);

    const list = await http().get('/v1/admin/reports').set(auth('admin')).expect(200);
    const ours = list.body.items.filter((r: { reporter: { id: string } }) => [ids.customer, ids.company].includes(r.reporter.id));
    expect(ours.map((r: { target: string }) => r.target).sort()).toEqual(['MESSAGE', 'REVIEW', 'REVIEW_REPLY']);
    const message = ours.find((r: { target: string }) => r.target === 'MESSAGE');
    expect(message).toMatchObject({
      content: 'Fiyatı şimdi iki katına çıkardık.',
      reason: 'FRAUD',
      reporter: { name: 'Denetim customer', role: 'CUSTOMER' },
      author: { name: 'Denetim Nakliyat', role: 'COMPANY' },
    });
    expect(message.requestId).toBeTruthy();

    await http().post(`/v1/admin/reports/${message.id}/resolve`).set(auth('admin')).send({ status: 'RESOLVED', removeContent: true }).expect(200);
    expect((await prisma.message.findUniqueOrThrow({ where: { id: companyMessageId } })).body).toBe('');

    const review = ours.find((r: { target: string }) => r.target === 'REVIEW');
    await http().post(`/v1/admin/reports/${review.id}/resolve`).set(auth('admin')).send({ status: 'DISMISSED' }).expect(200);
    expect((await prisma.review.findUniqueOrThrow({ where: { id: reviewId } })).isPublished).toBe(true);

    const reply = ours.find((r: { target: string }) => r.target === 'REVIEW_REPLY');
    await http()
      .post(`/v1/admin/reports/${reply.id}/resolve`)
      .set(auth('admin'))
      .send({ status: 'RESOLVED', removeContent: true, resolution: 'Müşteriye hakaret' })
      .expect(200);
    expect((await prisma.review.findUniqueOrThrow({ where: { id: reviewId } })).companyReply).toBeNull();

    const closed = await http().get('/v1/admin/reports?status=RESOLVED').set(auth('admin')).expect(200);
    expect(closed.body.items.some((r: { id: string; resolution: string }) => r.id === reply.id && r.resolution === 'Müşteriye hakaret')).toBe(true);
  });
});
