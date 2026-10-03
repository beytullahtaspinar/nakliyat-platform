import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { MoveRemindersService } from './../src/bookings/move-reminders.service.js';
import { DomainEvents } from './../src/events/domain-events.js';
import { todayInTurkey } from './../src/media/company-document-rules.js';
import { NOTIFICATION_CHANNELS, type ChannelProvider, type Recipient } from './../src/notifications/channels/channel.js';
import type { NotificationContent } from './../src/notifications/templates.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { addApprovedDocuments, markVerified } from './helpers.js';

class FakeEmail implements ChannelProvider {
  readonly channel = 'EMAIL' as const;
  sent: { to: string | null; content: NotificationContent }[] = [];
  async send(recipient: Recipient, content: NotificationContent) {
    this.sent.push({ to: recipient.email, content });
    return { status: 'SENT' as const };
  }
}

// Firma takvimi ve taşınma günü hatırlatması. Çalışan bir MariaDB/MySQL gerektirir.
describe('Takvim ve hatırlatma (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let events: DomainEvents;
  const email = new FakeEmail();
  const phones = { customer: '+905320001201', company: '+905320001202', other: '+905320001203' };
  const emails = { customer: 'musteri-takvim@test.local', company: 'firma-takvim@test.local', other: 'diger-takvim@test.local' };
  const tokens: Record<string, string> = {};
  const bookingIds: string[] = [];

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });
  const today = todayInTurkey();
  const addDays = (day: string, days: number) =>
    new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  /** Bugün, Türkiye saatiyle verilen saatte */
  const todayAt = (hourTr: number) => new Date(Date.parse(`${today}T00:00:00Z`) + (hourTr - 3) * 3_600_000);

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

  /** Müşteri talep açar, firma teklif verir, müşteri kabul eder: iş oluşur */
  const book = async (moveDate: string, company: 'company' | 'other' = 'company') => {
    const req = await http()
      .post('/v1/requests')
      .set(auth('customer'))
      .send({
        fromCityCode: '16', fromDistrict: 'nilufer', fromAddress: 'Takvim Sok. No:1', fromFloor: 1, fromHasElevator: false,
        toCityCode: '06', toDistrict: 'cankaya', toAddress: 'Takvim Sok. No:2', toFloor: 2, toHasElevator: true,
        homeType: 'TWO_PLUS_ONE', moveDate,
      })
      .expect(201);
    const quote = await http()
      .post(`/v1/company/requests/${req.body.id}/quotes`)
      .set(auth(company))
      .send({ priceTry: 12000, crewSize: 3, vehicleType: 'KAMYON' })
      .expect(201);
    await http().post(`/v1/quotes/${quote.body.id}/accept`).set(auth('customer')).expect(200);
    const booking = await prisma.booking.findUniqueOrThrow({ where: { quoteId: quote.body.id } });
    bookingIds.push(booking.id);
    return booking.id;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(NOTIFICATION_CHANNELS)
      .useValue([email])
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    events = app.get(DomainEvents);
    await cleanup();

    for (const who of ['customer', 'company', 'other'] as const) {
      const res = await http()
        .post('/v1/auth/register')
        .send({ role: who === 'customer' ? 'CUSTOMER' : 'COMPANY', fullName: `Takvim ${who}`, phone: phones[who], password: 'GucluSifre123', email: emails[who] })
        .expect(201);
      tokens[who] = res.body.accessToken;
    }
    await markVerified(prisma, Object.values(phones));
    for (const [who, tax] of [['company', '7777771202'], ['other', '7777771203']] as const) {
      const profile = await http()
        .post('/v1/company/profile')
        .set(auth(who))
        .send({ legalName: `Takvim ${who} Ltd.`, displayName: `Takvim ${who}`, taxNumber: tax, cityCode: '16', serviceCityCodes: ['16'] })
        .expect(201);
      await addApprovedDocuments(prisma, [profile.body.id]);
      await prisma.company.update({ where: { id: profile.body.id }, data: { verificationStatus: 'VERIFIED' } });
    }

    await book(addDays(today, 1));
    await book(addDays(today, 5));
    await book(addDays(today, 6), 'other');
    await events.drain();
    email.sent = [];
  });

  afterAll(async () => {
    await events.drain();
    await cleanup();
    await app.close();
  });

  it('firma yalnızca kendi işlerini, istenen günler arasında görür', async () => {
    const res = await http()
      .get('/v1/company/bookings/calendar')
      .query({ from: today, to: addDays(today, 10) })
      .set(auth('company'))
      .expect(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({
      id: bookingIds[0],
      day: addDays(today, 1),
      status: 'SCHEDULED',
      homeType: 'TWO_PLUS_ONE',
      from: { cityName: 'Bursa', districtName: 'Nilüfer' },
      to: { cityName: 'Ankara', districtName: 'Çankaya' },
      customerName: 'Takvim customer',
    });
    expect(JSON.stringify(res.body)).not.toContain('Takvim Sok');

    const narrow = await http()
      .get('/v1/company/bookings/calendar')
      .query({ from: addDays(today, 2), to: addDays(today, 5) })
      .set(auth('company'))
      .expect(200);
    expect(narrow.body.items.map((b: { id: string }) => b.id)).toEqual([bookingIds[1]]);
  });

  it('geçersiz aralık reddedilir, müşteri takvime erişemez', async () => {
    await http().get('/v1/company/bookings/calendar').query({ from: today, to: addDays(today, 42) }).set(auth('company')).expect(400);
    await http().get('/v1/company/bookings/calendar').query({ from: today, to: addDays(today, -1) }).set(auth('company')).expect(400);
    await http().get('/v1/company/bookings/calendar').query({ from: '2026-13-01', to: today }).set(auth('company')).expect(400);
    await http().get('/v1/company/bookings/calendar').query({ from: today, to: today }).set(auth('customer')).expect(403);
  });

  it('hatırlatma saat 10:00 (TSİ) öncesi gitmez', async () => {
    expect(await app.get(MoveRemindersService).sendDue(todayAt(9))).toBe(0);
  });

  it('yarın taşınacak iş için iki tarafa bir kez hatırlatma gider', async () => {
    const reminders = app.get(MoveRemindersService);
    expect(await reminders.sendDue(todayAt(11))).toBe(1);
    await events.drain();

    const toCustomer = email.sent.find((m) => m.to === emails.customer)?.content;
    const toCompany = email.sent.find((m) => m.to === emails.company)?.content;
    expect(toCustomer).toMatchObject({ type: 'MOVE_REMINDER', title: 'Yarın taşınıyorsun: Takvim company' });
    expect(toCustomer?.details).toContain('Telefon: 0532 000 12 02');
    expect(toCompany).toMatchObject({ type: 'MOVE_REMINDER', path: `/firma-paneli/isler/${bookingIds[0]}` });
    expect(toCompany?.details).toContain('Müşteri: Takvim customer');
    expect(email.sent.some((m) => m.to === emails.other)).toBe(false);

    expect(await reminders.sendDue(todayAt(14))).toBe(0);
    await events.drain();
    expect(email.sent).toHaveLength(2);
  });

  it('kullanıcı hatırlatma e-postasını kapatabilir', async () => {
    const prefs = await http().get('/v1/notifications/preferences').set(auth('company')).expect(200);
    expect(prefs.body.items.map((i: { type: string }) => i.type)).toContain('MOVE_REMINDER');
  });
});
