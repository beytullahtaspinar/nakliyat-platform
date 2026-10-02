import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { BrevoEmailCodeSender } from './brevo-email.sender.js';
import type { CodeSender } from './code-sender.js';
import { LogCodeSender } from './log.sender.js';
import { NetgsmSmsSender } from './netgsm-sms.sender.js';
import { WhatsAppCodeSender } from './whatsapp.sender.js';

const logger = new Logger('VerificationSenders');
const isProduction = (config: ConfigService) => config.get('NODE_ENV') === 'production';

/** BREVO_API_KEY varsa Brevo; yoksa geliştirmede log, canlıda null. */
export function createEmailSender(config: ConfigService): CodeSender | null {
  const apiKey = config.get<string>('BREVO_API_KEY');
  if (apiKey) return new BrevoEmailCodeSender(apiKey, config);
  if (isProduction(config)) {
    logger.error('BREVO_API_KEY tanımlı değil: e-posta doğrulama kodları gönderilemez');
    return null;
  }
  return new LogCodeSender('e-posta');
}

/**
 * PHONE_OTP_PROVIDER=netgsm | whatsapp | log (log yalnızca geliştirmede).
 * Tanımlı değilse telefon doğrulaması kapalıdır ve zorunlu tutulmaz.
 */
export function createPhoneSender(config: ConfigService): CodeSender | null {
  const provider = config.get<string>('PHONE_OTP_PROVIDER')?.trim().toLowerCase();
  if (!provider) return null;

  const missing = (names: string[]) => {
    const absent = names.filter((n) => !config.get<string>(n));
    if (absent.length) logger.error(`PHONE_OTP_PROVIDER=${provider} için eksik: ${absent.join(', ')}. Telefon doğrulaması kapalı.`);
    return absent.length > 0;
  };
  const domain = new URL(config.get<string>('WEB_URL') ?? 'https://evdenevenakliyat.app').hostname;

  switch (provider) {
    case 'netgsm':
      if (missing(['NETGSM_USERCODE', 'NETGSM_PASSWORD', 'NETGSM_HEADER'])) return null;
      return new NetgsmSmsSender({
        userCode: config.get<string>('NETGSM_USERCODE')!,
        password: config.get<string>('NETGSM_PASSWORD')!,
        header: config.get<string>('NETGSM_HEADER')!,
        domain,
      });
    case 'whatsapp':
      if (missing(['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'])) return null;
      return new WhatsAppCodeSender({
        token: config.get<string>('WHATSAPP_TOKEN')!,
        phoneNumberId: config.get<string>('WHATSAPP_PHONE_NUMBER_ID')!,
        template: config.get<string>('WHATSAPP_OTP_TEMPLATE') ?? 'dogrulama_kodu',
        language: config.get<string>('WHATSAPP_OTP_LANGUAGE') ?? 'tr',
      });
    case 'log':
      if (isProduction(config)) {
        logger.error('PHONE_OTP_PROVIDER=log canlıda kullanılamaz. Telefon doğrulaması kapalı.');
        return null;
      }
      return new LogCodeSender('telefon');
    default:
      logger.error(`Bilinmeyen PHONE_OTP_PROVIDER: ${provider}. Telefon doğrulaması kapalı.`);
      return null;
  }
}
