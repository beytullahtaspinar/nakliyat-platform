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

// Teklif kabulünden sonra müşteri–firma yazışması. Çalışan bir MariaDB/MySQL gerektirir.
describe('Mesajlaşma (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let events: DomainEvents;
  const email = new FakeEmail();
  const phones = {
    customer: '+905320000601',
    company: '+905320000602',
    other: '+905320000603',
    otherCompany: '+905320000604',
    admin: '+905320000605',
  };
  const emails = { customer: 'musteri-mesaj@test.local', company: 'firma-mesaj@test.local' };
  const tokens: Record<string, string> = {};
  let companyId: string;
  let requestId: string;
  let bookingId: string;

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });
  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const mailsTo = (address: string) => email.sent.filter((m) => m.to === address && m.content.type === 'NEW_MESSAGE');

  const cleanup = async () => {
    const users = { phone: { in: Object.values(phones) } };
    await prisma.message.deleteMany({ where: { sender: users } });
    await prisma.booking.deleteMany({ where: { request: { customer: users } } });
    await prisma.quote.deleteMany({ where: { request: { customer: users } } });
    await prisma.movingRequest.deleteMany({ where: { customer: users } });
    await prisma.company.deleteMany({ where: { owner: users } });
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.user.deleteMany({ where: users });
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

    for (const who of ['customer', 'company', 'other', 'otherCompany'] as const) {
      const role = who === 'company' || who === 'otherCompany' ? 'COMPANY' : 'CUSTOMER';
      const res = await http()
        .post('/v1/auth/register')
        .send({ role, fullName: `Mesaj ${who}`, phone: phones[who], password: 'GucluSifre123', ...(who in emails && { email: emails[who as keyof typeof emails] }) })
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
      .send({ legalName: 'Mesaj Nakliyat Ltd.', displayName: 'Mesaj Nakliyat', taxNumber: '7777777401', cityCode: '35', serviceCityCodes: ['35'] })
      .expect(201);
    companyId = profile.body.id;
    await addApprovedDocuments(prisma, [companyId]);
    await http().post(`/v1/admin/companies/${companyId}/verify`).set(auth('admin')).expect(200);

    const req = await http()
      .post('/v1/requests')
      .set(auth('customer'))
      .send({
        fromCityCode: '35', fromDistrict: 'karsiyaka', fromAddress: 'Mesaj Sok. No:1', fromFloor: 1, fromHasElevator: false,
        toCityCode: '35', toDistrict: 'bornova', toAddress: 'Yanıt Sok. No:2', toFloor: 2, toHasElevator: true,
        homeType: 'TWO_PLUS_ONE', moveDate: inDays(10),
      })
      .expect(201);
    requestId = req.body.id;
    const quote = await http()
      .post(`/v1/company/requests/${requestId}/quotes`)
      .set(auth('company'))
      .send({ priceTry: 9000, crewSize: 2, vehicleType: 'KAMYONET' })
      .expect(201);
    const accepted = await http().post(`/v1/quotes/${quote.body.id}/accept`).set(auth('customer')).expect(200);
    bookingId = accepted.body.booking.id;
    await events.drain();
  });

  afterAll(async () => {
    await events.drain();
    await cleanup();
    await app.close();
  });

  it('müşteri firmaya yazar; firma ilk okunmamış mesajda e-posta alır', async () => {
    const res = await http()
      .post(`/v1/bookings/${bookingId}/messages`)
      .set(auth('customer'))
      .send({ body: '  Merhaba, sabah 9 uygun mu?  ' })
      .expect(201);
    expect(res.body).toMatchObject({ body: 'Merhaba, sabah 9 uygun mu?', mine: true, readAt: null });
    await http().post(`/v1/bookings/${bookingId}/messages`).set(auth('customer')).send({ body: 'Bir de piyano var.' }).expect(201);
    await events.drain();

    const mails = mailsTo(emails.company);
    expect(mails).toHaveLength(1);
    expect(mails[0].content).toMatchObject({
      title: 'Mesaj customer sana mesaj yazdı',
      body: 'Merhaba, sabah 9 uygun mu?',
      path: `/firma-paneli/isler/${bookingId}`,
    });

    const unread = await http().get('/v1/messages/unread').set(auth('company')).expect(200);
    expect(unread.body).toEqual({ total: 2, items: [{ bookingId, requestId, count: 2 }] });
  });

  it('boş ya da çok uzun mesaj reddedilir', async () => {
    await http().post(`/v1/bookings/${bookingId}/messages`).set(auth('customer')).send({ body: '   ' }).expect(400);
    await http().post(`/v1/bookings/${bookingId}/messages`).set(auth('customer')).send({ body: 'a'.repeat(2001) }).expect(400);
  });

  it('işin tarafı olmayan konuşmayı göremez ve yazamaz', async () => {
    await http().get(`/v1/bookings/${bookingId}/messages`).set(auth('other')).expect(404);
    await http().get(`/v1/bookings/${bookingId}/messages`).set(auth('otherCompany')).expect(404);
    await http().post(`/v1/bookings/${bookingId}/messages`).set(auth('otherCompany')).send({ body: 'selam' }).expect(404);
    await http().get(`/v1/bookings/${bookingId}/messages`).set(auth('admin')).expect(403);
  });

  it('yönetici firma gözünden okuyunca mesajlar okunmamış kalır; yazdığı mesaj kaydedilir', async () => {
    const imp = await http().post(`/v1/admin/companies/${companyId}/impersonate`).set(auth('admin')).expect(200);
    const asCompany = { Authorization: `Bearer ${imp.body.accessToken}` };
    const list = await http().get(`/v1/bookings/${bookingId}/messages`).set(asCompany).expect(200);
    expect(list.body.items).toHaveLength(2);
    expect((await http().get('/v1/messages/unread').set(auth('company')).expect(200)).body.total).toBe(2);

    await http().post(`/v1/bookings/${bookingId}/messages`).set(asCompany).send({ body: 'Destek ekibinden not.' }).expect(201);
    const adminId = (await prisma.user.findUniqueOrThrow({ where: { phone: phones.admin } })).id;
    const log = await prisma.auditLog.findFirst({ where: { actorId: adminId, action: 'company.impersonate.action' } });
    expect(log?.details).toEqual({ method: 'POST', path: `/v1/bookings/${bookingId}/messages` });
    await events.drain();
  });

  it('firma okuyunca mesajlar okundu olur; yanıtı müşteriye bildirilir', async () => {
    const list = await http().get(`/v1/bookings/${bookingId}/messages`).set(auth('company')).expect(200);
    expect(list.body).toMatchObject({ counterpart: 'Mesaj customer', canSend: true, requestId });
    expect(list.body.items.map((m: { body: string; mine: boolean }) => [m.body, m.mine])).toEqual([
      ['Merhaba, sabah 9 uygun mu?', false],
      ['Bir de piyano var.', false],
      ['Destek ekibinden not.', true],
    ]);
    expect((await http().get('/v1/messages/unread').set(auth('company')).expect(200)).body.total).toBe(0);

    await http().post(`/v1/bookings/${bookingId}/messages`).set(auth('company')).send({ body: 'Uygun, piyano için ek ekip getiririz.' }).expect(201);
    await events.drain();
    // Müşteri ilk okunmamış (yönetici notu) için bir kez bildirilir, sonraki yanıt için tekrar e-posta gitmez
    const mails = mailsTo(emails.customer);
    expect(mails).toHaveLength(1);
    expect(mails[0].content).toMatchObject({ title: 'Mesaj Nakliyat sana mesaj yazdı', path: `/hesabim/talepler/${requestId}#mesajlar` });

    const customerView = await http().get(`/v1/bookings/${bookingId}/messages`).set(auth('customer')).expect(200);
    expect(customerView.body.counterpart).toBe('Mesaj Nakliyat');
    expect(customerView.body.items[0].readAt).not.toBeNull();

    // Okuduktan sonra gelen yeni mesaj yine bildirilir
    await http().post(`/v1/bookings/${bookingId}/messages`).set(auth('company')).send({ body: 'Görüşmek üzere.' }).expect(201);
    await events.drain();
    expect(mailsTo(emails.customer)).toHaveLength(2);
  });

  it('iptal edilen işin konuşması salt okunur', async () => {
    await prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    const list = await http().get(`/v1/bookings/${bookingId}/messages`).set(auth('customer')).expect(200);
    expect(list.body.canSend).toBe(false);
    await http().post(`/v1/bookings/${bookingId}/messages`).set(auth('customer')).send({ body: 'son' }).expect(409);
  });
});
