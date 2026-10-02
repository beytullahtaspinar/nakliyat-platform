import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { DomainEvents } from './../src/events/domain-events.js';
import { NOTIFICATION_CHANNELS, type ChannelProvider, type Recipient } from './../src/notifications/channels/channel.js';
import type { NotificationContent } from './../src/notifications/templates.js';
import { NotificationsService } from './../src/notifications/notifications.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { addApprovedDocuments, markVerified } from './helpers.js';

/** Gerçek e-posta göndermeyen sahte kanal: gönderilenleri kaydeder, istenirse hata verir. */
class FakeEmail implements ChannelProvider {
  readonly channel = 'EMAIL' as const;
  sent: { to: string | null; content: NotificationContent }[] = [];
  failNext = 0;
  async send(recipient: Recipient, content: NotificationContent) {
    if (this.failNext > 0) {
      this.failNext--;
      throw new Error('geçici hata');
    }
    if (!recipient.email) return { status: 'SKIPPED' as const, reason: 'e-posta yok' };
    this.sent.push({ to: recipient.email, content });
    return { status: 'SENT' as const };
  }
}

// Olay → bildirim akışı. Çalışan bir MariaDB/MySQL gerektirir.
describe('Bildirimler (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let events: DomainEvents;
  const email = new FakeEmail();
  const phones = { customer: '+905320000301', company: '+905320000302', admin: '+905320000303' };
  const emails = { customer: 'musteri-bildirim@test.local', company: 'firma-bildirim@test.local' };
  const tokens: Record<string, string> = {};
  let companyId: string;
  let requestId: string;
  let quoteId: string;

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });
  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const userId = async (who: keyof typeof phones) =>
    (await prisma.user.findUniqueOrThrow({ where: { phone: phones[who] } })).id;
  const sentTo = (address: string) => email.sent.filter((m) => m.to === address).map((m) => m.content.type);

  const cleanup = async () => {
    const users = { phone: { in: Object.values(phones) } };
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

    for (const who of ['customer', 'company'] as const) {
      const res = await http()
        .post('/v1/auth/register')
        .send({ role: who.toUpperCase(), fullName: `Bildirim ${who}`, phone: phones[who], password: 'GucluSifre123', ...(who === 'company' && { email: emails.company }) })
        .expect(201);
      tokens[who] = res.body.accessToken;
    }
    await markVerified(prisma, [phones.customer, phones.company]);
    await prisma.user.create({
      data: { role: 'ADMIN', fullName: 'Admin', phone: phones.admin, passwordHash: await bcrypt.hash('GucluSifre123', 4) },
    });
    tokens.admin = (await http().post('/v1/auth/login').send({ phone: phones.admin, password: 'GucluSifre123' }).expect(200)).body.accessToken;

    const profile = await http()
      .post('/v1/company/profile')
      .set(auth('company'))
      .send({ legalName: 'Bildirim Nakliyat Ltd.', displayName: 'Bildirim Nakliyat', taxNumber: '7777777301', cityCode: '16', serviceCityCodes: ['16'] })
      .expect(201);
    companyId = profile.body.id;
    await addApprovedDocuments(prisma, [companyId]);
  });

  afterAll(async () => {
    await events.drain();
    await cleanup();
    await app.close();
  });

  it('firma onaylanınca uygulama içi bildirim ve e-posta gider', async () => {
    await http().post(`/v1/admin/companies/${companyId}/verify`).set(auth('admin')).expect(200);
    await events.drain();
    expect(sentTo(emails.company)).toEqual(['COMPANY_VERIFICATION']);

    const inbox = await http().get('/v1/notifications').set(auth('company')).expect(200);
    expect(inbox.body.unread).toBe(1);
    expect(inbox.body.items[0]).toMatchObject({ type: 'COMPANY_VERIFICATION', title: 'Firma hesabın onaylandı', readAt: null });
    expect(inbox.body.items[0].data.path).toBe('/firma-paneli');
  });

  it('tercihler role göre listelenir; müşteri e-posta adresini ekleyebilir', async () => {
    const before = await http().get('/v1/notifications/preferences').set(auth('customer')).expect(200);
    expect(before.body.email).toBeNull();
    expect(before.body.items.map((i: { type: string }) => i.type)).toEqual(['NEW_QUOTE', 'QUOTE_ACCEPTED']);
    expect(before.body.items[0].channels).toEqual({ EMAIL: true });

    await http().patch('/v1/notifications/preferences').set(auth('customer')).send({ email: emails.company }).expect(409);
    await http().patch('/v1/notifications/preferences').set(auth('customer')).send({ email: 'gecersiz' }).expect(400);
    const after = await http()
      .patch('/v1/notifications/preferences')
      .set(auth('customer'))
      // Firma türü (NEW_REQUEST) müşteri için yok sayılır
      .send({ email: ` ${emails.customer.toUpperCase()} `, items: [{ type: 'QUOTE_ACCEPTED', channel: 'EMAIL', enabled: false }, { type: 'NEW_REQUEST', channel: 'EMAIL', enabled: false }] })
      .expect(200);
    expect(after.body.email).toBe(emails.customer);
    expect(after.body.items[1]).toMatchObject({ type: 'QUOTE_ACCEPTED', channels: { EMAIL: false } });
    expect(await prisma.notificationPreference.count({ where: { userId: await userId('customer') } })).toBe(1);
    // Adres değişince yeniden doğrulanmalı
    const customer = await prisma.user.findUniqueOrThrow({ where: { phone: phones.customer } });
    expect(customer.emailVerifiedAt).toBeNull();
    await markVerified(prisma, [phones.customer]);
  });

  it('bölgedeki talep firmaya, açık adres olmadan bildirilir', async () => {
    const res = await http()
      .post('/v1/requests')
      .set(auth('customer'))
      .send({
        fromCityCode: '16', fromDistrict: 'nilufer', fromAddress: 'Gizli Sok. No:7', fromFloor: 1, fromHasElevator: false,
        toCityCode: '06', toDistrict: 'cankaya', toAddress: 'Başka Sok. No:3', toFloor: 2, toHasElevator: true,
        homeType: 'THREE_PLUS_ONE', moveDate: inDays(15),
      })
      .expect(201);
    requestId = res.body.id;
    await events.drain();

    const mail = email.sent.find((m) => m.to === emails.company && m.content.type === 'NEW_REQUEST');
    expect(mail?.content.title).toBe('Yeni talep: Nilüfer, Bursa → Çankaya, Ankara');
    expect(mail?.content.path).toBe(`/firma-paneli/talepler/${requestId}`);
    expect(JSON.stringify(mail)).not.toContain('Gizli Sok');
  });

  it('yeni teklif müşteriye bildirilir', async () => {
    const res = await http()
      .post(`/v1/company/requests/${requestId}/quotes`)
      .set(auth('company'))
      .send({ priceTry: 18500, crewSize: 3, vehicleType: 'KAMYON' })
      .expect(201);
    quoteId = res.body.id;
    await events.drain();
    const mail = email.sent.find((m) => m.to === emails.customer);
    expect(mail?.content).toMatchObject({ type: 'NEW_QUOTE', path: `/hesabim/talepler/${requestId}` });
    expect(mail?.content.title).toMatch(/^Bildirim Nakliyat teklif verdi: ₺18\.500$/);
  });

  it('teklif kabulü iki tarafa bildirilir; müşteri e-postayı kapattığı için yalnızca uygulama içi alır', async () => {
    await http().post(`/v1/quotes/${quoteId}/accept`).set(auth('customer')).expect(200);
    await events.drain();
    expect(sentTo(emails.customer)).toEqual(['NEW_QUOTE']);
    expect(sentTo(emails.company)).toEqual(['COMPANY_VERIFICATION', 'NEW_REQUEST', 'QUOTE_ACCEPTED']);

    const inbox = await http().get('/v1/notifications').set(auth('customer')).expect(200);
    expect(inbox.body.items.map((n: { type: string }) => n.type)).toEqual(['QUOTE_ACCEPTED', 'NEW_QUOTE']);

    await http().post(`/v1/notifications/${inbox.body.items[0].id}/read`).set(auth('customer')).expect(204);
    await http().post(`/v1/notifications/${inbox.body.items[0].id}/read`).set(auth('company')).expect(404);
    await http().post('/v1/notifications/read-all').set(auth('customer')).expect(204);
    expect((await http().get('/v1/notifications').set(auth('customer')).expect(200)).body.unread).toBe(0);
  });

  it('başarısız e-posta kaydedilir ve yeniden denenir', async () => {
    email.failNext = 1;
    await http().post(`/v1/admin/companies/${companyId}/reject`).set(auth('admin')).send({ reason: 'K3 belgesi okunmuyor' }).expect(200);
    await events.drain();
    const row = await prisma.notification.findFirstOrThrow({
      where: { userId: await userId('company'), channel: 'EMAIL', title: 'Firma hesabın onaylanmadı' },
    });
    expect(row).toMatchObject({ status: 'FAILED', attempts: 1, lastError: 'geçici hata' });

    await app.get(NotificationsService).retryFailed();
    const retried = await prisma.notification.findUniqueOrThrow({ where: { id: row.id } });
    expect(retried).toMatchObject({ status: 'SENT', attempts: 2, lastError: null });
    expect(email.sent.at(-1)?.content.details).toEqual(['Gerekçe: K3 belgesi okunmuyor']);
  });

  it('e-posta adresi olmayan kullanıcı için gönderim SKIPPED kaydedilir', async () => {
    await http().patch('/v1/notifications/preferences').set(auth('company')).send({ email: null }).expect(200);
    await http().post(`/v1/admin/companies/${companyId}/verify`).set(auth('admin')).expect(200);
    await events.drain();
    const row = await prisma.notification.findFirstOrThrow({
      where: { userId: await userId('company'), channel: 'EMAIL' },
      orderBy: { createdAt: 'desc' },
    });
    expect(row).toMatchObject({ status: 'SKIPPED', type: 'COMPANY_VERIFICATION' });
  });
});
