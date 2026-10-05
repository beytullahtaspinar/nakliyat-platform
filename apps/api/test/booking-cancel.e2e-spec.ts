import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { DomainEvents } from './../src/events/domain-events.js';
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

// Anlaşılan işin müşteri ya da firma tarafından gerekçeyle iptali.
// Çalışan bir MariaDB/MySQL gerektirir.
describe('İş iptali (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let events: DomainEvents;
  const email = new FakeEmail();
  const phones = {
    customer: '+905320000971',
    company: '+905320000972',
    other: '+905320000973',
    admin: '+905320000974',
  };
  const emails = { customer: 'musteri-iptal@test.local', company: 'firma-iptal@test.local' };
  const tokens: Record<string, string> = {};
  let companyId: string;

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });
  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const mails = (address: string) => email.sent.filter((m) => m.to === address && m.content.type === 'BOOKING_CANCELLED');

  const cleanup = async () => {
    const users = { phone: { in: Object.values(phones) } };
    await prisma.message.deleteMany({ where: { booking: { request: { customer: users } } } });
    await prisma.booking.deleteMany({ where: { request: { customer: users } } });
    await prisma.quote.deleteMany({ where: { request: { customer: users } } });
    await prisma.movingRequest.deleteMany({ where: { customer: users } });
    await prisma.company.deleteMany({ where: { owner: users } });
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.user.deleteMany({ where: users });
  };

  /** Müşteri talep açar, firma teklif verir, müşteri kabul eder; işin kimliğini döner */
  const book = async (moveInDays: number) => {
    const req = await http()
      .post('/v1/requests')
      .set(auth('customer'))
      .send({
        fromCityCode: '61', fromDistrict: 'ortahisar', fromAddress: 'İptal Sok. No:1', fromFloor: 1, fromHasElevator: false,
        toCityCode: '61', toDistrict: 'akcaabat', toAddress: 'İptal Sok. No:2', toFloor: 2, toHasElevator: true,
        homeType: 'ONE_PLUS_ONE', moveDate: inDays(moveInDays),
      })
      .expect(201);
    const quote = await http()
      .post(`/v1/company/requests/${req.body.id}/quotes`)
      .set(auth('company'))
      .send({ priceTry: 9000, crewSize: 2, vehicleType: 'KAMYONET' })
      .expect(201);
    const accepted = await http().post(`/v1/quotes/${quote.body.id}/accept`).set(auth('customer')).expect(200);
    await events.drain();
    return { requestId: req.body.id as string, bookingId: accepted.body.booking.id as string };
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

    const names = { customer: 'Ayşe İptalci', company: 'Firma Yetkilisi', other: 'Başka Müşteri' };
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
      .send({ legalName: 'İptal Nakliyat Ltd.', displayName: 'İptal Test Nakliyat', taxNumber: '7777777901', cityCode: '61', serviceCityCodes: ['61'] })
      .expect(201);
    companyId = profile.body.id;
    await addApprovedDocuments(prisma, [companyId]);
    await http().post(`/v1/admin/companies/${companyId}/verify`).set(auth('admin')).expect(200);
  });

  afterAll(async () => {
    await events.drain();
    await cleanup();
    await app.close();
  });

  it('planlanmış iş iptal edilebilir görünür; tarafı olmayan iptal edemez, gerekçe zorunlu', async () => {
    const { bookingId } = await book(5);
    const list = await http().get('/v1/bookings').set(auth('customer')).expect(200);
    expect(list.body.items.find((b: { id: string }) => b.id === bookingId)).toMatchObject({ canCancel: true });

    await http().post(`/v1/bookings/${bookingId}/cancel`).set(auth('other')).send({ reason: 'Benim işim değil' }).expect(404);
    await http().post(`/v1/bookings/${bookingId}/cancel`).set(auth('admin')).send({ reason: 'Yönetici denemesi' }).expect(403);
    await http().post(`/v1/bookings/${bookingId}/cancel`).set(auth('customer')).send({ reason: 'kısa' }).expect(400);
  });

  it('müşteri iptal eder: iş ve talep iptal olur, firmaya gerekçeyle bildirim gider, mesajlaşma kapanır', async () => {
    const { requestId, bookingId } = await book(6);
    const res = await http()
      .post(`/v1/bookings/${bookingId}/cancel`)
      .set(auth('customer'))
      .send({ reason: '  Taşınma tarihim bir ay ertelendi.  ' })
      .expect(200);
    expect(res.body).toMatchObject({ id: bookingId, status: 'CANCELLED', cancelledBy: 'CUSTOMER', cancelReason: 'Taşınma tarihim bir ay ertelendi.' });
    await events.drain();

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(booking).toMatchObject({ status: 'CANCELLED', cancelReason: 'Taşınma tarihim bir ay ertelendi.' });
    expect(booking.cancelledAt).toBeInstanceOf(Date);
    expect((await prisma.movingRequest.findUniqueOrThrow({ where: { id: requestId } })).status).toBe('CANCELLED');

    const sent = mails(emails.company);
    expect(sent).toHaveLength(1);
    expect(sent[0].content.details).toContain('İptal nedeni: Taşınma tarihim bir ay ertelendi.');
    expect(sent[0].content.path).toBe(`/firma-paneli/isler/${bookingId}`);
    expect(mails(emails.customer)).toHaveLength(0);

    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'booking.cancel', entityId: bookingId } });
    expect(log.details).toMatchObject({ cancelledBy: 'CUSTOMER' });

    const company = await http().get('/v1/company/bookings').set(auth('company')).expect(200);
    expect(company.body.items.find((b: { id: string }) => b.id === bookingId)).toMatchObject({
      status: 'CANCELLED',
      canCancel: false,
      canComplete: false,
    });
    await http().post(`/v1/bookings/${bookingId}/messages`).set(auth('company')).send({ body: 'Merhaba?' }).expect(409);
    await http().post(`/v1/bookings/${bookingId}/cancel`).set(auth('company')).send({ reason: 'Tekrar iptal' }).expect(409);
    await http().post(`/v1/bookings/${bookingId}/complete`).set(auth('company')).expect(409);
  });

  it('firma iptal eder: müşteriye yeni talep önerisiyle bildirim gider', async () => {
    const { bookingId } = await book(7);
    email.sent.length = 0;
    await http().post(`/v1/bookings/${bookingId}/cancel`).set(auth('company')).send({ reason: 'Aracımız arızalandı.' }).expect(200);
    await events.drain();
    const sent = mails(emails.customer);
    expect(sent).toHaveLength(1);
    expect(sent[0].content).toMatchObject({ title: 'İptal Test Nakliyat taşımanı iptal etti', path: '/talep-olustur' });
    expect(mails(emails.company)).toHaveLength(0);
  });

  it('taşınma günü iptal edilebilir, günü geçen ya da tamamlanan iş iptal edilemez', async () => {
    const today = await book(3);
    await prisma.booking.update({ where: { id: today.bookingId }, data: { scheduledAt: new Date(inDays(0)) } });
    await http().post(`/v1/bookings/${today.bookingId}/cancel`).set(auth('customer')).send({ reason: 'Son dakika vazgeçtim.' }).expect(200);

    const past = await book(4);
    await prisma.booking.update({ where: { id: past.bookingId }, data: { scheduledAt: new Date(inDays(-1)) } });
    const res = await http().post(`/v1/bookings/${past.bookingId}/cancel`).set(auth('company')).send({ reason: 'Geriye dönük iptal' }).expect(409);
    expect(res.body.message).toContain('Taşınma günü geçen');

    await http().post(`/v1/bookings/${past.bookingId}/complete`).set(auth('company')).expect(200);
    await http().post(`/v1/bookings/${past.bookingId}/cancel`).set(auth('customer')).send({ reason: 'Tamamlandıktan sonra' }).expect(409);
  });
});
