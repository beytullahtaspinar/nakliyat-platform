import { ConfigService } from '@nestjs/config';
import webpush, { WebPushError } from 'web-push';
import { UserRole } from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { templates } from '../templates.js';
import type { ExpoPushSender, MobileDelivery } from './expo-push.js';
import { isPushEndpoint, WebPushChannel } from './web-push.channel.js';

const keys = webpush.generateVAPIDKeys();
const env = { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey };
const recipient = { userId: 'u1', role: UserRole.COMPANY, fullName: 'Hızlı Nakliyat', email: null, phone: '+905321234567' };
const content = templates.newMessage({ senderName: 'Ayşe Yılmaz', body: 'Merhaba, saat kaçta gelirsiniz?', path: '/firma-paneli/isler/b1' });
const sub = (id: string) => ({ id, userId: 'u1', endpoint: `https://fcm.googleapis.com/fcm/send/${id}`, p256dh: 'p', auth: 'a' });

const fakePrisma = (subscriptions: ReturnType<typeof sub>[]) => {
  const pushSubscription = {
    findMany: vi.fn().mockResolvedValue(subscriptions),
    count: vi.fn().mockResolvedValue(subscriptions.length),
    update: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  return { prisma: { pushSubscription } as unknown as PrismaService, pushSubscription };
};
/** Mobil uygulama gönderimi: varsayılan olarak kayıtlı telefon yok */
const fakeMobile = (result: MobileDelivery = { devices: 0, delivered: 0 }) =>
  ({ hasDevices: vi.fn().mockResolvedValue(result.devices > 0), sendToUser: vi.fn().mockResolvedValue(result) }) as unknown as ExpoPushSender;
const gone = () => new WebPushError('gone', 410, {}, 'expired', 'x');

describe('isPushEndpoint', () => {
  it('yalnızca bilinen push servislerine izin verir', () => {
    expect(isPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true);
    expect(isPushEndpoint('https://web.push.apple.com/QGx')).toBe(true);
    expect(isPushEndpoint('https://wns2-db5p.notify.windows.com/w/?token=abc')).toBe(true);
    expect(isPushEndpoint('http://fcm.googleapis.com/fcm/send/abc')).toBe(false);
    expect(isPushEndpoint('https://fcm.googleapis.com:8443/x')).toBe(false);
    expect(isPushEndpoint('https://evilfcm.googleapis.com.example.com/x')).toBe(false);
    expect(isPushEndpoint('https://127.0.0.1/x')).toBe(false);
    expect(isPushEndpoint('bozuk')).toBe(false);
  });
});

describe('WebPushChannel', () => {
  afterEach(() => vi.restoreAllMocks());

  it('VAPID anahtarı yoksa göndermez ve kanal kullanılamaz sayılır', async () => {
    const send = vi.spyOn(webpush, 'sendNotification');
    const { prisma } = fakePrisma([sub('s1')]);
    const channel = new WebPushChannel(new ConfigService({}), prisma, fakeMobile());
    expect(channel.publicKey).toBeNull();
    await expect(channel.isAvailable(recipient)).resolves.toBe(false);
    await expect(channel.send(recipient, content)).resolves.toEqual({ status: 'SKIPPED', reason: 'VAPID anahtarları tanımlı değil' });
    expect(send).not.toHaveBeenCalled();
  });

  it('tüm cihazlara başlık, metin ve açılacak yolu gönderir', async () => {
    const send = vi.spyOn(webpush, 'sendNotification').mockResolvedValue({ statusCode: 201, body: '', headers: {} });
    const { prisma, pushSubscription } = fakePrisma([sub('s1'), sub('s2')]);
    const result = await new WebPushChannel(new ConfigService(env), prisma, fakeMobile()).send(recipient, content);
    expect(result).toEqual({ status: 'SENT' });
    expect(send).toHaveBeenCalledTimes(2);
    const [target, body, options] = send.mock.calls[0];
    expect(target).toEqual({ endpoint: 'https://fcm.googleapis.com/fcm/send/s1', keys: { p256dh: 'p', auth: 'a' } });
    expect(JSON.parse(body as string)).toEqual({
      title: 'Ayşe Yılmaz sana mesaj yazdı',
      body: 'Merhaba, saat kaçta gelirsiniz?',
      path: '/firma-paneli/isler/b1',
      tag: 'NEW_MESSAGE:/firma-paneli/isler/b1',
    });
    expect(options).toMatchObject({ urgency: 'high', vapidDetails: { publicKey: keys.publicKey, subject: 'mailto:destek@evdenevenakliyat.app' } });
    expect(pushSubscription.update).toHaveBeenCalledTimes(2);
  });

  it('süresi dolmuş aboneliği siler, diğer cihaza ulaştıysa gönderildi sayar', async () => {
    vi.spyOn(webpush, 'sendNotification')
      .mockRejectedValueOnce(gone())
      .mockResolvedValueOnce({ statusCode: 201, body: '', headers: {} });
    const { prisma, pushSubscription } = fakePrisma([sub('s1'), sub('s2')]);
    const result = await new WebPushChannel(new ConfigService(env), prisma, fakeMobile()).send(recipient, content);
    expect(result).toEqual({ status: 'SENT' });
    expect(pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { id: 's1' } });
  });

  it('hiçbir cihaza geçici hata yüzünden ulaşamazsa yeniden denensin diye hata fırlatır', async () => {
    vi.spyOn(webpush, 'sendNotification').mockRejectedValue(new WebPushError('down', 503, {}, 'unavailable', 'x'));
    const { prisma, pushSubscription } = fakePrisma([sub('s1')]);
    await expect(new WebPushChannel(new ConfigService(env), prisma, fakeMobile()).send(recipient, content)).rejects.toThrow('Push gönderilemedi: 503 unavailable');
    expect(pushSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it('tüm abonelikler geçersizse atlanır, yeniden denenmez', async () => {
    vi.spyOn(webpush, 'sendNotification').mockRejectedValue(gone());
    const { prisma } = fakePrisma([sub('s1')]);
    const result = await new WebPushChannel(new ConfigService(env), prisma, fakeMobile()).send(recipient, content);
    expect(result.status).toBe('SKIPPED');
  });

  it('VAPID anahtarı olmasa da mobil uygulamaya gönderir', async () => {
    const send = vi.spyOn(webpush, 'sendNotification');
    const { prisma } = fakePrisma([sub('s1')]);
    const mobile = fakeMobile({ devices: 1, delivered: 1 });
    const channel = new WebPushChannel(new ConfigService({}), prisma, mobile);
    await expect(channel.isAvailable(recipient)).resolves.toBe(true);
    await expect(channel.send(recipient, content)).resolves.toEqual({ status: 'SENT' });
    expect(send).not.toHaveBeenCalled();
    expect(mobile.sendToUser).toHaveBeenCalledWith('u1', expect.objectContaining({ path: '/firma-paneli/isler/b1' }), true);
  });

  it('telefona ulaşılamadı ama tarayıcıya ulaştıysa gönderildi sayar; ikisi de olmazsa yeniden denenir', async () => {
    vi.spyOn(webpush, 'sendNotification').mockResolvedValue({ statusCode: 201, body: '', headers: {} });
    const { prisma } = fakePrisma([sub('s1')]);
    const failing = fakeMobile({ devices: 1, delivered: 0, error: 'MessageRateExceeded' });
    await expect(new WebPushChannel(new ConfigService(env), prisma, failing).send(recipient, content)).resolves.toEqual({ status: 'SENT' });
    await expect(new WebPushChannel(new ConfigService({}), prisma, failing).send(recipient, content)).rejects.toThrow('MessageRateExceeded');
  });
});
