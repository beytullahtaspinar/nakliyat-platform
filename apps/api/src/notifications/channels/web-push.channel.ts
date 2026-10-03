import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush, { WebPushError } from 'web-push';
import { NotificationChannel } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { NotificationContent } from '../templates.js';
import type { ChannelProvider, DeliveryResult, Recipient } from './channel.js';

const TIMEOUT_MS = 10_000;
/** Telefon kapalıysa push servisi bildirimi bu kadar süre saklar; sonra bayat sayılıp atılır */
const TTL_SECONDS = 24 * 60 * 60;
/** Kullanıcı başına en fazla bu kadar cihaz: eskiler silinir */
export const MAX_DEVICES = 10;

/**
 * Yalnızca bilinen tarayıcı push servislerine istek atılır. Abonelik adresini istemci gönderdiği için
 * bu liste olmadan API sunucusu, kullanıcının yazdığı herhangi bir adrese istek atmaya zorlanabilirdi.
 */
const PUSH_HOSTS = [
  'fcm.googleapis.com', // Chrome, Edge (Android), Samsung Internet, Opera
  'push.services.mozilla.com', // Firefox
  'notify.windows.com', // Edge (Windows)
  'push.apple.com', // Safari (iPhone, Mac)
];

export const isPushEndpoint = (endpoint: string) => {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && !url.port && PUSH_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
};

export const endpointHash = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex');

/** Servis işçisinin (apps/web/public/sw.js) beklediği bildirim içeriği */
export interface PushPayload {
  title: string;
  body: string;
  /** Bildirime dokununca açılacak yol */
  path: string;
  /** Aynı etiketli yeni bildirim eskisinin yerine geçer (ör. aynı konuşmadaki mesajlar) */
  tag: string;
}

type Urgency = 'very-low' | 'low' | 'normal' | 'high';
/** Firmanın hemen görmesi gerekenler: telefon pil tasarrufundayken de hemen iletilir */
const HIGH_URGENCY = new Set<string>(['NEW_REQUEST', 'QUOTE_ACCEPTED', 'NEW_MESSAGE']);

/**
 * Standart Web Push (VAPID): Chrome/Android, Firefox, Edge ve ana ekrana eklenmiş iPhone (iOS 16.4+)
 * aynı yolla bildirim alır; ücretli bir servis gerekmez.
 * Ortam değişkenleri: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: adresi).
 * Anahtarlar yoksa push kapalıdır: ayarlarda görünmez, gönderim yapılmaz.
 */
@Injectable()
export class WebPushChannel implements ChannelProvider {
  readonly channel = NotificationChannel.PUSH;
  private readonly logger = new Logger(WebPushChannel.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** Tarayıcının abone olurken kullandığı açık anahtar; push kapalıysa null */
  get publicKey(): string | null {
    return this.vapid()?.publicKey ?? null;
  }

  private vapid() {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    if (!publicKey || !privateKey) return null;
    const subject = this.config.get<string>('VAPID_SUBJECT') || 'mailto:destek@evdenevenakliyat.app';
    return { publicKey, privateKey, subject };
  }

  /** Kayıtlı cihazı olmayan kullanıcı için her bildirimde boşuna gönderim satırı açılmasın. */
  async isAvailable(recipient: Recipient) {
    if (!this.vapid()) return false;
    return (await this.prisma.pushSubscription.count({ where: { userId: recipient.userId } })) > 0;
  }

  async send(recipient: Recipient, content: NotificationContent): Promise<DeliveryResult> {
    return this.sendToUser(
      recipient.userId,
      { title: content.title, body: content.body, path: content.path, tag: `${content.type}:${content.path}` },
      HIGH_URGENCY.has(content.type) ? 'high' : 'normal',
    );
  }

  /**
   * Kullanıcının tüm cihazlarına gönderir. En az bir cihaza ulaştıysa SENT; geçersiz abonelikler
   * (uygulama kaldırıldı, izin geri alındı) silinir. Hiçbir cihaza geçici bir hata yüzünden
   * ulaşılamadıysa hata fırlatılır ve bildirim yeniden denenir.
   */
  async sendToUser(userId: string, payload: PushPayload, urgency: Urgency = 'normal'): Promise<DeliveryResult> {
    const vapid = this.vapid();
    if (!vapid) return { status: 'SKIPPED', reason: 'VAPID anahtarları tanımlı değil' };
    const subscriptions = await this.prisma.pushSubscription.findMany({ where: { userId } });
    if (!subscriptions.length) return { status: 'SKIPPED', reason: 'Bildirim açılmış cihaz yok' };

    const body = JSON.stringify(payload);
    let delivered = 0;
    let lastError: unknown;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, {
          vapidDetails: vapid,
          TTL: TTL_SECONDS,
          urgency,
          timeout: TIMEOUT_MS,
        });
        delivered++;
        await this.prisma.pushSubscription.update({ where: { id: sub.id }, data: { lastUsedAt: new Date() } });
      } catch (e) {
        if (e instanceof WebPushError && [404, 410].includes(e.statusCode)) {
          // Abonelik artık geçersiz: tarayıcı izni geri alındı ya da uygulama silindi
          await this.prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
          continue;
        }
        lastError = e;
        this.logger.warn(`Push gönderilemedi: ${describe(e)}`);
      }
    }
    if (delivered > 0) return { status: 'SENT' };
    if (lastError) throw new Error(`Push gönderilemedi: ${describe(lastError)}`);
    return { status: 'SKIPPED', reason: 'Cihaz aboneliklerinin süresi dolmuş' };
  }
}

/** Hata mesajında abonelik adresi (kişiye özel) yer almaz; durum kodu ve kısa gövde yeterli. */
function describe(e: unknown) {
  if (e instanceof WebPushError) return `${e.statusCode} ${String(e.body ?? '').slice(0, 200)}`.trim();
  return e instanceof Error ? e.message : String(e);
}
