import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { DomainEvents } from './../src/events/domain-events.js';
import { todayInTurkey } from './../src/media/company-document-rules.js';
import { NOTIFICATION_CHANNELS, type ChannelProvider, type Recipient } from './../src/notifications/channels/channel.js';
import type { NotificationContent } from './../src/notifications/templates.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { BookingFollowUpService } from './../src/reviews/booking-follow-up.service.js';
import { addApprovedDocuments, markVerified, retryOnConflict } from './helpers.js';

class FakeEmail implements ChannelProvider {
  readonly channel = 'EMAIL' as const;
  sent: { to: string | null; content: NotificationContent }[] = [];
  async send(recipient: Recipient, content: NotificationContent) {
    this.sent.push({ to: recipient.email, content });
    return { status: 'SENT' as const };
  }
}

// Taşınma günü geçen işler: ertesi gün soru, 7 gün sonra otomatik tamamlama, itiraz ve yönetim kararı.
// Çalışan bir MariaDB/MySQL gerektirir.
describe('Taşınma sonrası takip (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let events: DomainEvents;
  let followUp: BookingFollowUpService;
  const email = new FakeEmail();
  const phones = {
    customer: '+905320002201',
    company: '+905320002202',
    other: '+905320002203',
    admin: '+905320002204',
  };
  const emails = { customer: 'musteri-takip@test.local', company: 'firma-takip@test.local' };
  const tokens: Record<string, string> = {};
  let companyId: string;

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });
  const today = todayInTurkey();
  const day = (offset: number) => new Date(Date.parse(`${today}T00:00:00.000Z`) + offset * 86_400_000);
  const dayText = (offset: number) => day(offset).toISOString().slice(0, 10);
  /** Bugün 10:30 TSİ (07:30 UTC): takip işinin çalıştığı saat */
  const morning = new Date(`${today}T07:30:00.000Z`);
  const run = (now = morning) => followUp.run(now, { companyId });
  const mails = (address: string, type: string) => email.sent.filter((m) => m.to === address && m.content.type === type);

  const cleanup = async () => {
    const users = { phone: { in: Object.values(phones) } };
    await prisma.review.deleteMany({ where: { customer: users } });
    await prisma.message.deleteMany({ where: { booking: { request: { customer: users } } } });
    await prisma.booking.deleteMany({ where: { request: { customer: users } } });
    await prisma.quote.deleteMany({ where: { request: { customer: users } } });
    await prisma.movingRequest.deleteMany({ where: { customer: users } });
    await prisma.company.deleteMany({ where: { owner: users } });
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.user.deleteMany({ where: users });
  };

  /** Müşteri talep açar, firma teklif verir, müşteri kabul eder; ardından taşınma günü `moveOffset` güne çekilir */
  const book = async (moveOffset: number) => {
    const req = await http()
      .post('/v1/requests')
      .set(auth('customer'))
      .send({
        fromCityCode: '61', fromDistrict: 'ortahisar', fromAddress: 'Takip Sok. No:1', fromFloor: 1, fromHasElevator: false,
        toCityCode: '61', toDistrict: 'akcaabat', toAddress: 'Takip Sok. No:2', toFloor: 2, toHasElevator: true,
        homeType: 'ONE_PLUS_ONE', moveDate: dayText(5),
      })
      .expect(201);
    const quote = await http()
      .post(`/v1/company/requests/${req.body.id}/quotes`)
      .set(auth('company'))
      .send({ priceTry: 9000, crewSize: 2, vehicleType: 'KAMYONET' })
      .expect(201);
    const accepted = await http().post(`/v1/quotes/${quote.body.id}/accept`).set(auth('customer')).expect(200);
    await events.drain();
    const bookingId = accepted.body.booking.id as string;
    await prisma.booking.update({ where: { id: bookingId }, data: { scheduledAt: day(moveOffset) } });
    email.sent.length = 0;
    return { requestId: req.body.id as string, bookingId };
  };
  const customerView = async (bookingId: string) =>
    (await http().get('/v1/bookings').set(auth('customer')).expect(200)).body.items.find((b: { id: string }) => b.id === bookingId);

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
    followUp = app.get(BookingFollowUpService);
    await retryOnConflict(cleanup);

    const names = { customer: 'Ayşe Takipçi', company: 'Firma Yetkilisi', other: 'Başka Müşteri' };
    for (const who of ['customer', 'company', 'other'] as const) {
      const res = await http()
        .post('/v1/auth/register')
        .send({
          role: who === 'company' ? 'COMPANY' : 'CUSTOMER',
          fullName: names[who],
          phone: phones[who],
          password: 'GucluSifre123',
          ...(who in emails && { email: emails[who as keyof typeof emails] }),
        })
        .expect(201);
      tokens[who] = res.body.accessToken;
    }
    await markVerified(prisma, Object.values(phones));
    await prisma.user.create({
      data: { role: 'ADMIN', fullName: 'Admin', phone: phones.admin, passwordHash: await bcrypt.hash('GucluSifre123', 4) },
    });
    tokens.admin = (await http().post('/v1/auth/login').send({ phone: phones.admin, password: 'GucluSifre123' }).expect(200)).body.accessToken;

    const profile = await http()
      .post('/v1/company/profile')
      .set(auth('company'))
      .send({ legalName: 'Takip Nakliyat Ltd.', displayName: 'Takip Test Nakliyat', taxNumber: '7777777902', cityCode: '61', serviceCityCodes: ['61'] })
      .expect(201);
    companyId = profile.body.id;
    await addApprovedDocuments(prisma, [companyId]);
    await http().post(`/v1/admin/companies/${companyId}/verify`).set(auth('admin')).expect(200);
  });

  afterAll(async () => {
    await events.drain();
    await retryOnConflict(cleanup);
    await app.close();
  });

  it('taşınmanın ertesi günü iki tarafa bir kez "tamamlandı mı?" sorulur; 10:00 TSİ öncesinde sorulmaz', async () => {
    const { bookingId, requestId } = await book(-1);
    expect(await customerView(bookingId)).toMatchObject({ canComplete: true, canDispute: true, canCancel: false, autoCompleteOn: dayText(6) });

    expect(await run(new Date(`${today}T06:59:00.000Z`))).toEqual({ checks: 0, completed: 0 });
    expect(await run()).toEqual({ checks: 1, completed: 0 });
    await events.drain();
    const [toCustomer] = mails(emails.customer, 'BOOKING_FOLLOW_UP');
    expect(toCustomer?.content).toMatchObject({ title: 'Taşınman tamamlandı mı? Takip Test Nakliyat', path: `/hesabim/talepler/${requestId}` });
    expect(mails(emails.company, 'BOOKING_FOLLOW_UP')[0]?.content.path).toBe(`/firma-paneli/isler/${bookingId}`);

    expect(await run()).toEqual({ checks: 0, completed: 0 });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe('SCHEDULED');
  });

  it('taşınmadan 7 gün sonra itirazsız iş kendiliğinden tamamlanır, müşteriden değerlendirme istenir', async () => {
    const { bookingId, requestId } = await book(-7);
    const before = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    expect((await run()).completed).toBe(1);
    await events.drain();

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(booking).toMatchObject({ status: 'COMPLETED', completedBy: 'SYSTEM' });
    expect((await prisma.movingRequest.findUniqueOrThrow({ where: { id: requestId } })).status).toBe('COMPLETED');
    expect((await prisma.company.findUniqueOrThrow({ where: { id: companyId } })).completedJobs).toBe(before.completedJobs + 1);

    const review = mails(emails.customer, 'REVIEW_REQUEST');
    expect(review).toHaveLength(1);
    expect(review[0]!.content.body).toContain('7 gün geçti');
    expect(mails(emails.company, 'BOOKING_FOLLOW_UP')[0]?.content.title).toMatch(/^İş tamamlandı sayıldı/);
    // Hâlâ soru gönderilmemiş işe artık soru gitmez
    expect(mails(emails.customer, 'BOOKING_FOLLOW_UP')).toHaveLength(0);

    await http().post(`/v1/bookings/${bookingId}/review`).set(auth('customer')).send({ rating: 5 }).expect(201);
  });

  it('taşınma gününden önce itiraz edilemez; tarafı olmayan itiraz edemez, neden zorunlu', async () => {
    const { bookingId } = await book(2);
    const res = await http().post(`/v1/bookings/${bookingId}/dispute`).set(auth('customer')).send({ reason: 'Firma gelmedi.' }).expect(409);
    expect(res.body.message).toContain('Taşınma günü gelmeden');
    await prisma.booking.update({ where: { id: bookingId }, data: { scheduledAt: day(0) } });
    await http().post(`/v1/bookings/${bookingId}/dispute`).set(auth('other')).send({ reason: 'Benim işim değil' }).expect(404);
    await http().post(`/v1/bookings/${bookingId}/dispute`).set(auth('admin')).send({ reason: 'Yönetici denemesi' }).expect(403);
    await http().post(`/v1/bookings/${bookingId}/dispute`).set(auth('customer')).send({ reason: 'kısa' }).expect(400);
  });

  it('itirazlı iş kendiliğinden tamamlanmaz; yönetici "yapıldı" derse tamamlanır ve müşteri değerlendirir', async () => {
    const { bookingId, requestId } = await book(-8);
    const res = await http()
      .post(`/v1/bookings/${bookingId}/dispute`)
      .set(auth('customer'))
      .send({ reason: '  Firma taşınma günü gelmedi, telefonu da açmadı.  ' })
      .expect(200);
    expect(res.body).toMatchObject({ disputedBy: 'CUSTOMER', disputeReason: 'Firma taşınma günü gelmedi, telefonu da açmadı.' });
    await events.drain();
    const toCompany = mails(emails.company, 'BOOKING_FOLLOW_UP');
    expect(toCompany).toHaveLength(1);
    expect(toCompany[0]!.content.details).toContain('İtiraz nedeni: Firma taşınma günü gelmedi, telefonu da açmadı.');
    expect(mails(emails.customer, 'BOOKING_FOLLOW_UP')).toHaveLength(0);

    expect(await run()).toEqual({ checks: 0, completed: 0 });
    expect(await customerView(bookingId)).toMatchObject({ canComplete: false, canDispute: false, canCancel: false, autoCompleteOn: null });
    await http().post(`/v1/bookings/${bookingId}/complete`).set(auth('company')).expect(409);
    await http().post(`/v1/bookings/${bookingId}/dispute`).set(auth('company')).send({ reason: 'Biz de itiraz ediyoruz' }).expect(409);
    await http().post(`/v1/bookings/${bookingId}/review`).set(auth('customer')).send({ rating: 1 }).expect(409);

    const summary = await http().get('/v1/admin/summary').set(auth('admin')).expect(200);
    expect(summary.body.disputes.open).toBeGreaterThanOrEqual(1);
    const open = await http().get('/v1/admin/bookings/disputes').set(auth('admin')).expect(200);
    expect(open.body.items.find((b: { id: string }) => b.id === bookingId)).toMatchObject({
      disputedBy: 'CUSTOMER',
      customer: { fullName: 'Ayşe Takipçi' },
      company: { displayName: 'Takip Test Nakliyat' },
      from: 'Trabzon, Ortahisar',
    });
    await http().get('/v1/admin/bookings/disputes').set(auth('customer')).expect(403);

    email.sent.length = 0;
    await http()
      .post(`/v1/admin/bookings/${bookingId}/resolve-dispute`)
      .set(auth('admin'))
      .send({ decision: 'complete', note: 'Firma teslim fotoğraflarını gönderdi.' })
      .expect(200);
    await events.drain();
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).toMatchObject({
      status: 'COMPLETED',
      completedBy: 'ADMIN',
      disputeResolution: 'Firma teslim fotoğraflarını gönderdi.',
    });
    expect((await prisma.movingRequest.findUniqueOrThrow({ where: { id: requestId } })).status).toBe('COMPLETED');
    const resolved = mails(emails.customer, 'BOOKING_FOLLOW_UP');
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.content).toMatchObject({ title: 'İtiraz sonuçlandı: iş tamamlandı sayıldı', path: `/hesabim/talepler/${requestId}#degerlendirme` });
    expect(mails(emails.company, 'BOOKING_FOLLOW_UP')).toHaveLength(1);
    // Yönetici kararı ayrıca "değerlendirme iste" bildirimi göndermez (tek bildirim yeter)
    expect(mails(emails.customer, 'REVIEW_REQUEST')).toHaveLength(0);

    const done = await http().get('/v1/admin/bookings/disputes?status=resolved').set(auth('admin')).expect(200);
    expect(done.body.items.some((b: { id: string }) => b.id === bookingId)).toBe(true);
    await http()
      .post(`/v1/admin/bookings/${bookingId}/resolve-dispute`)
      .set(auth('admin'))
      .send({ decision: 'cancel', note: 'İkinci karar denemesi' })
      .expect(409);
    await http().post(`/v1/bookings/${bookingId}/review`).set(auth('customer')).send({ rating: 2 }).expect(201);
  });

  it('firma itiraz eder, yönetici "yapılmadı" derse iş ve talep iptal olur', async () => {
    const { bookingId, requestId } = await book(0);
    await http().post(`/v1/bookings/${bookingId}/dispute`).set(auth('company')).send({ reason: 'Müşteri adreste yoktu.' }).expect(200);
    await events.drain();
    expect(mails(emails.customer, 'BOOKING_FOLLOW_UP')[0]?.content.title).toBe('İtiraz: Takip Test Nakliyat taşınmanın yapılmadığını bildirdi');
    // Taşınma günü bile olsa itirazlı iş taraflarca iptal edilemez
    await http().post(`/v1/bookings/${bookingId}/cancel`).set(auth('customer')).send({ reason: 'Vazgeçtim artık' }).expect(409);

    await http()
      .post(`/v1/admin/bookings/${bookingId}/resolve-dispute`)
      .set(auth('admin'))
      .send({ decision: 'cancel', note: 'İki taraf da taşınmanın yapılmadığını doğruladı.' })
      .expect(200);
    await events.drain();
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).toMatchObject({ status: 'CANCELLED', completedBy: null });
    expect((await prisma.movingRequest.findUniqueOrThrow({ where: { id: requestId } })).status).toBe('CANCELLED');
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'booking.dispute_resolve', entityId: bookingId } });
    expect(log.details).toMatchObject({ decision: 'cancel' });
    await http().post(`/v1/admin/bookings/${bookingId}/resolve-dispute`).set(auth('admin')).send({ decision: 'xx', note: 'Geçersiz karar' }).expect(400);
  });
});
