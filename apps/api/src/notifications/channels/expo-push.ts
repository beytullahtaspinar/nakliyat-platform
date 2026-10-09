import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PushPayload } from './web-push.channel.js';

const SEND_URL = 'https://exp.host/--/api/v2/push/send';
const TIMEOUT_MS = 10_000;
/** Telefon kapalıysa bildirim bu kadar süre saklanır */
const TTL_SECONDS = 24 * 60 * 60;
/** Kullanıcı başına en fazla bu kadar telefon: eskiler silinir */
export const MAX_MOBILE_DEVICES = 10;

/** Expo'nun verdiği adres biçimi; başka bir şey kaydedilmez */
export const isExpoPushToken = (token: string) => /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{1,200}\]$/.test(token);

export interface MobileDelivery {
  /** Kayıtlı telefon sayısı */
  devices: number;
  delivered: number;
  /** Hiçbir telefona ulaşılamadıysa ve hata geçiciyse dolu */
  error?: string;
}

interface Ticket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

/**
 * Mobil uygulamalara (firma ve müşteri) Expo push servisi üzerinden bildirim. Expo, Android'de
 * Firebase'e, iPhone'da Apple'a iletir; bu anahtarlar expo.dev'de proje ayarlarında durur.
 * EXPO_ACCESS_TOKEN tanımlıysa istek onunla imzalanır (Expo'da "enhanced security" açıksa gerekir).
 */
@Injectable()
export class ExpoPushSender {
  private readonly logger = new Logger(ExpoPushSender.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async hasDevices(userId: string) {
    return (await this.prisma.mobilePushToken.count({ where: { userId } })) > 0;
  }

  async sendToUser(userId: string, payload: PushPayload, highPriority: boolean): Promise<MobileDelivery> {
    const devices = await this.prisma.mobilePushToken.findMany({ where: { userId }, take: MAX_MOBILE_DEVICES });
    if (!devices.length) return { devices: 0, delivered: 0 };

    const messages = devices.map((d) => ({
      to: d.token,
      title: payload.title,
      body: payload.body,
      // Uygulama dokunulunca açılacak ekranı yol ve türden (etiketin başı) bulur
      data: { path: payload.path, tag: payload.tag },
      sound: 'default',
      priority: highPriority ? 'high' : 'normal',
      channelId: 'default',
      ttl: TTL_SECONDS,
    }));

    let tickets: Ticket[];
    try {
      const token = this.config.get<string>('EXPO_ACCESS_TOKEN');
      const res = await fetch(SEND_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
      tickets = ((await res.json()) as { data?: Ticket[] }).data ?? [];
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Mobil bildirim gönderilemedi: ${error}`);
      return { devices: devices.length, delivered: 0, error };
    }

    let delivered = 0;
    let error: string | undefined;
    const used: string[] = [];
    for (const [i, device] of devices.entries()) {
      const ticket = tickets[i];
      if (ticket?.status === 'ok') {
        delivered++;
        used.push(device.id);
      } else if (ticket?.details?.error === 'DeviceNotRegistered') {
        // Uygulama silindi ya da bildirim izni kapatıldı
        await this.prisma.mobilePushToken.deleteMany({ where: { id: device.id } });
      } else {
        error = ticket?.details?.error ?? ticket?.message ?? 'Yanıt yok';
      }
    }
    if (used.length) await this.prisma.mobilePushToken.updateMany({ where: { id: { in: used } }, data: { lastUsedAt: new Date() } });
    if (error && !delivered) this.logger.warn(`Mobil bildirim gönderilemedi: ${error}`);
    return { devices: devices.length, delivered, ...(delivered ? {} : { error }) };
  }
}
