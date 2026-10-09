import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { ExpoPushSender, isExpoPushToken } from './expo-push.js';

const device = (id: string) => ({ id, userId: 'u1', token: `ExponentPushToken[${id}]`, platform: 'android' });
const payload = { title: 'Yeni talep', body: 'Kadıköy → Üsküdar', path: '/firma-paneli/talepler/r1', tag: 'NEW_REQUEST:/firma-paneli/talepler/r1' };

const fakePrisma = (devices: ReturnType<typeof device>[]) => {
  const mobilePushToken = {
    findMany: vi.fn().mockResolvedValue(devices),
    count: vi.fn().mockResolvedValue(devices.length),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  return { prisma: { mobilePushToken } as unknown as PrismaService, mobilePushToken };
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });

describe('isExpoPushToken', () => {
  it('yalnızca Expo bildirim adresini kabul eder', () => {
    expect(isExpoPushToken('ExponentPushToken[abc-DEF_123]')).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[abc]')).toBe(true);
    expect(isExpoPushToken('ExponentPushToken[]')).toBe(false);
    expect(isExpoPushToken('https://exp.host/x')).toBe(false);
    expect(isExpoPushToken('ExponentPushToken[a b]')).toBe(false);
  });
});

describe('ExpoPushSender', () => {
  afterEach(() => vi.restoreAllMocks());

  it('kayıtlı telefon yoksa istek atmaz', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const { prisma } = fakePrisma([]);
    await expect(new ExpoPushSender(new ConfigService({}), prisma).sendToUser('u1', payload, true)).resolves.toEqual({ devices: 0, delivered: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('tüm telefonlara başlık, metin ve açılacak yolu gönderir', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply([{ status: 'ok', id: 't1' }, { status: 'ok', id: 't2' }]));
    const { prisma, mobilePushToken } = fakePrisma([device('a'), device('b')]);
    const result = await new ExpoPushSender(new ConfigService({ EXPO_ACCESS_TOKEN: 'gizli' }), prisma).sendToUser('u1', payload, true);
    expect(result).toEqual({ devices: 2, delivered: 2 });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer gizli');
    expect(JSON.parse(init!.body as string)[0]).toMatchObject({
      to: 'ExponentPushToken[a]',
      title: 'Yeni talep',
      body: 'Kadıköy → Üsküdar',
      data: { path: '/firma-paneli/talepler/r1', tag: 'NEW_REQUEST:/firma-paneli/talepler/r1' },
      priority: 'high',
      channelId: 'default',
    });
    expect(mobilePushToken.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['a', 'b'] } }, data: { lastUsedAt: expect.any(Date) } });
  });

  it('uygulaması silinmiş telefonun kaydını siler', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      reply([{ status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } }, { status: 'ok' }]),
    );
    const { prisma, mobilePushToken } = fakePrisma([device('a'), device('b')]);
    const result = await new ExpoPushSender(new ConfigService({}), prisma).sendToUser('u1', payload, false);
    expect(result).toEqual({ devices: 2, delivered: 1 });
    expect(mobilePushToken.deleteMany).toHaveBeenCalledWith({ where: { id: 'a' } });
  });

  it('servis hata verirse hatayı bildirir, kaydı silmez', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('down', { status: 503 }));
    const { prisma, mobilePushToken } = fakePrisma([device('a')]);
    const result = await new ExpoPushSender(new ConfigService({}), prisma).sendToUser('u1', payload, false);
    expect(result).toMatchObject({ devices: 1, delivered: 0, error: '503 down' });
    expect(mobilePushToken.deleteMany).not.toHaveBeenCalled();
  });
});
