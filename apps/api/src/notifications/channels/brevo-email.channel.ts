import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, UserRole } from '../../generated/prisma/enums.js';
import type { NotificationContent } from '../templates.js';
import type { ChannelProvider, DeliveryResult, Recipient } from './channel.js';
import { renderEmail } from './email-layout.js';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 10_000;

/**
 * Brevo (eski adıyla Sendinblue) işlem e-postası API'si.
 * Ortam değişkenleri: BREVO_API_KEY, MAIL_FROM_EMAIL, MAIL_FROM_NAME, WEB_URL.
 * BREVO_API_KEY yoksa (yerel geliştirme, CI) e-posta gönderilmez, SKIPPED kaydedilir.
 */
@Injectable()
export class BrevoEmailChannel implements ChannelProvider {
  readonly channel = NotificationChannel.EMAIL;
  private readonly logger = new Logger(BrevoEmailChannel.name);

  constructor(private readonly config: ConfigService) {}

  async send(recipient: Recipient, content: NotificationContent): Promise<DeliveryResult> {
    const apiKey = this.config.get<string>('BREVO_API_KEY');
    if (!apiKey) return { status: 'SKIPPED', reason: 'BREVO_API_KEY tanımlı değil' };
    if (!recipient.email) return { status: 'SKIPPED', reason: 'Kullanıcının e-posta adresi yok' };

    const { subject, html, text } = renderEmail(content, {
      recipientName: recipient.fullName,
      webUrl: this.config.get<string>('WEB_URL') ?? 'https://evdenevenakliyat.app',
      settingsPath: recipient.role === UserRole.COMPANY ? '/firma-paneli/bildirimler' : '/hesabim/bildirimler',
    });

    const res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: {
          email: this.config.get<string>('MAIL_FROM_EMAIL') ?? 'bildirim@evdenevenakliyat.app',
          name: this.config.get<string>('MAIL_FROM_NAME') ?? 'evdenevenakliyat.app',
        },
        to: [{ email: recipient.email, name: recipient.fullName }],
        subject,
        htmlContent: html,
        textContent: text,
        tags: [content.type],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      // Yanıt gövdesinde API anahtarı olmaz; hata kodu ve mesajı tanı için yeterli.
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new Error(`Brevo ${res.status}: ${detail}`);
    }
    this.logger.log(`E-posta gönderildi (${content.type})`);
    return { status: 'SENT' };
  }
}
