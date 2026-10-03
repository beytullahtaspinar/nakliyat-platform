import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import webpush, { WebPushError } from 'web-push';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { DomainEvents } from './../src/events/domain-events.js';
import { NotificationsService } from './../src/notifications/notifications.service.js';
import { templates } from './../src/notifications/templates.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Anlık bildirim aboneliği ve gönderimi. Push servisine gerçek istek atılmaz. Çalışan bir MariaDB/MySQL gerektirir.
describe('Anlık bildirim (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let notifications: NotificationsService;
  const phones = { company: '+905320000401', customer: '+905320000402' };
  const tokens: Record<string, string> = {};
  const endpoint = 'https://fcm.googleapis.com/fcm/send/e2e-cihaz-1';
  const subscription = { endpoint, keys: { p256dh: 'BOr-p256dh-anahtari', auth: 'auth-anahtari' } };
  const send = vi.spyOn(webpush, 'sendNotification');
  const vapidEnv = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'] as const;
  const savedEnv = vapidEnv.map((k) => process.env[k]);

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });
  const userId = async (who: keyof typeof phones) => (await prisma.user.findUniqueOrThrow({ where: { phone: phones[who] } })).id;
  const message = () => templates.newMessage({ senderName: 'Ayşe Yılmaz', body: 'Merhaba', path: '/firma-paneli/isler/b1' });
  const cleanup = () => prisma.user.deleteMany({ where: { phone: { in: Object.values(phones) } } });

  beforeAll(async () => {
    const keys = webpush.generateVAPIDKeys();
    process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    process.env.VAPID_PRIVATE_KEY = keys.privateKey;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    notifications = app.get(NotificationsService);
    await cleanup();
    for (const who of ['company', 'customer'] as const) {
      const res = await http()
        .post('/v1/auth/register')
        .send({ role: who.toUpperCase(), fullName: `Push ${who}`, phone: phones[who], password: 'GucluSifre123' })
        .expect(201);
      tokens[who] = res.body.accessToken;
    }
  });

  beforeEach(() => send.mockReset().mockResolvedValue({ statusCode: 201, body: '', headers: {} }));

  afterAll(async () => {
    await app.get(DomainEvents).drain();
    await cleanup();
    await app.close();
    send.mockRestore();
    vapidEnv.forEach((k, i) => (savedEnv[i] === undefined ? delete process.env[k] : (process.env[k] = savedEnv[i])));
  });

  it('ayarlarda anlık bildirim kanalı ve açık anahtar görünür', async () => {
    const res = await http().get('/v1/notifications/preferences').set(auth('company')).expect(200);
    expect(res.body.channels).toEqual(['EMAIL', 'PUSH']);
    expect(res.body.push).toEqual({ publicKey: process.env.VAPID_PUBLIC_KEY, devices: 0 });
    expect(res.body.items[0].channels).toEqual({ EMAIL: true, PUSH: true });
  });

  it('cihaz yalnızca bilinen push servisi adresiyle kaydedilir', async () => {
    await http().post('/v1/notifications/push/subscriptions').set(auth('company')).send({ ...subscription, endpoint: 'https://127.0.0.1/ic-servis' }).expect(400);
    await http().post('/v1/notifications/push/subscriptions').set(auth('company')).send({ endpoint }).expect(400);
    await http().post('/v1/notifications/push/subscriptions').set(auth('company')).send(subscription).expect(204);
    // Aynı cihaz ikinci kez kaydedilince çoğalmaz
    await http().post('/v1/notifications/push/subscriptions').set(auth('company')).send(subscription).expect(204);
    const res = await http().get('/v1/notifications/preferences').set(auth('company')).expect(200);
    expect(res.body.push.devices).toBe(1);
  });

  it('bildirim kayıtlı cihaza gider; cihazı olmayana gönderim kaydı açılmaz', async () => {
    const company = await userId('company');
    const customer = await userId('customer');
    await notifications.notify(company, message());
    await notifications.notify(customer, message());

    expect(send).toHaveBeenCalledTimes(1);
    const [target, body] = send.mock.calls[0];
    expect(target).toEqual(subscription);
    expect(JSON.parse(body as string)).toMatchObject({ title: 'Ayşe Yılmaz sana mesaj yazdı', path: '/firma-paneli/isler/b1' });
    expect(await prisma.notification.findMany({ where: { userId: company, channel: 'PUSH' }, select: { status: true } })).toEqual([{ status: 'SENT' }]);
    expect(await prisma.notification.count({ where: { userId: customer, channel: 'PUSH' } })).toBe(0);
  });

  it('kullanıcı türü push için kapattıysa gönderilmez', async () => {
    await http()
      .patch('/v1/notifications/preferences')
      .set(auth('company'))
      .send({ items: [{ type: 'NEW_MESSAGE', channel: 'PUSH', enabled: false }] })
      .expect(200);
    await notifications.notify(await userId('company'), message());
    expect(send).not.toHaveBeenCalled();
    await http()
      .patch('/v1/notifications/preferences')
      .set(auth('company'))
      .send({ items: [{ type: 'NEW_MESSAGE', channel: 'PUSH', enabled: true }] })
      .expect(200);
  });

  it('deneme bildirimi gönderilir', async () => {
    const res = await http().post('/v1/notifications/push/test').set(auth('company')).expect(201);
    expect(res.body).toEqual({ sent: true });
    expect(JSON.parse(send.mock.calls[0][1] as string)).toMatchObject({ title: 'Bildirimler açık', tag: 'TEST' });
    const none = await http().post('/v1/notifications/push/test').set(auth('customer')).expect(201);
    expect(none.body).toEqual({ sent: false });
  });

  it('aynı cihazda başka hesapla açılınca bildirimler yeni hesaba gider', async () => {
    await http().post('/v1/notifications/push/subscriptions').set(auth('customer')).send(subscription).expect(204);
    expect(await prisma.pushSubscription.findMany({ where: { endpoint }, select: { userId: true } })).toEqual([{ userId: await userId('customer') }]);
    await http().post('/v1/notifications/push/subscriptions').set(auth('company')).send(subscription).expect(204);
  });

  it('süresi dolmuş abonelik silinir', async () => {
    send.mockRejectedValueOnce(new WebPushError('gone', 410, {}, '', endpoint));
    await notifications.notify(await userId('company'), message());
    expect(await prisma.pushSubscription.count({ where: { endpoint } })).toBe(0);
    expect(await prisma.notification.findFirst({ where: { userId: await userId('company'), channel: 'PUSH' }, orderBy: { createdAt: 'desc' }, select: { status: true } })).toEqual({ status: 'SKIPPED' });
  });

  it('cihaz kaydı silinebilir; başkasının kaydı silinemez', async () => {
    await http().post('/v1/notifications/push/subscriptions').set(auth('company')).send(subscription).expect(204);
    await http().delete('/v1/notifications/push/subscriptions').set(auth('customer')).send({ endpoint }).expect(204);
    expect(await prisma.pushSubscription.count({ where: { endpoint } })).toBe(1);
    await http().delete('/v1/notifications/push/subscriptions').set(auth('company')).send({ endpoint }).expect(204);
    expect(await prisma.pushSubscription.count({ where: { endpoint } })).toBe(0);
  });
});
