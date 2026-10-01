import type { NotificationChannel, UserRole } from '../../generated/prisma/enums.js';
import type { NotificationContent } from '../templates.js';

export interface Recipient {
  userId: string;
  role: UserRole;
  fullName: string;
  email: string | null;
  phone: string;
}

export type DeliveryResult =
  | { status: 'SENT' }
  /** Gönderilmedi ve denenmeyecek: kanal yapılandırılmamış veya alıcının adresi yok */
  | { status: 'SKIPPED'; reason: string };

/**
 * Dış bildirim kanalı (e-posta, SMS, push). Yeni kanal eklemek için bu arayüzü uygulayıp
 * NOTIFICATION_CHANNELS listesine ekle. Geçici hatalarda hata fırlat: yeniden denenir.
 */
export interface ChannelProvider {
  readonly channel: NotificationChannel;
  send(recipient: Recipient, content: NotificationContent): Promise<DeliveryResult>;
}

export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');
