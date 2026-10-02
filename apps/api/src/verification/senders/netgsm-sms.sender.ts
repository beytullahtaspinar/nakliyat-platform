import { failure, type CodeRecipient, type CodeSender } from './code-sender.js';

const NETGSM_OTP_URL = 'https://api.netgsm.com.tr/sms/rest/v2/otp';
const TIMEOUT_MS = 10_000;

export interface NetgsmConfig {
  /** Netgsm abone numarası veya API alt kullanıcısı */
  userCode: string;
  password: string;
  /** Onaylı SMS başlığı (ör. EVDENEVENKL) */
  header: string;
  /** WebOTP için sitenin alan adı (evdenevenakliyat.app) */
  domain: string;
}

/**
 * SMS metni. OTP hattı Türkçe karakter desteklemediği için ASCII yazılır.
 * Son satır WebOTP biçimidir: Android Chrome kodu sayfadaki alana kendisi doldurur.
 */
export const smsText = (code: string, domain: string) =>
  `evdenevenakliyat.app dogrulama kodunuz: ${code}. Kod 10 dakika gecerlidir, kimseyle paylasmayin.\n\n@${domain} #${code}`;

/**
 * Netgsm OTP SMS (REST v2). Normal SMS hattından daha hızlı ve ucuzdur, yalnızca tek numaraya gider.
 * Hesap açılınca ilk gönderimde test edilmeli: docs/dogrulama.md.
 */
export class NetgsmSmsSender implements CodeSender {
  readonly provider = 'netgsm';

  constructor(private readonly cfg: NetgsmConfig) {}

  async send(to: CodeRecipient, code: string) {
    const auth = Buffer.from(`${this.cfg.userCode}:${this.cfg.password}`).toString('base64');
    const res = await fetch(NETGSM_OTP_URL, {
      method: 'POST',
      headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        msgheader: this.cfg.header,
        // Netgsm numarayı ülke kodu olmadan bekler: 5XXXXXXXXX
        messages: [{ msg: smsText(code, this.cfg.domain), no: to.address.replace(/^\+90/, '') }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // Netgsm sonuç kodunu hem 200 hem 406 yanıtının gövdesinde verir; başarı "00"
    if (res.status !== 200 && res.status !== 406) throw await failure('Netgsm', res);
    const body = (await res.json().catch(() => null)) as { code?: string; description?: string } | null;
    if (body?.code !== '00') {
      throw new Error(`Netgsm ${body?.code ?? res.status}: ${body?.description ?? 'beklenmeyen yanıt'}`);
    }
  }
}
