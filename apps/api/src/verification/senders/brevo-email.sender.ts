import type { ConfigService } from '@nestjs/config';
import { failure, type CodeRecipient, type CodeSender } from './code-sender.js';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 10_000;

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Kod e-postası. Kod boşluksuz ve tek dokunuşla seçilir (user-select: all): kopyalayınca hane
 * kaybolmaz. Konu satırında da kod var; Gmail ve iOS Mail bunu tanıyıp kendi "Kodu kopyala"
 * düğmesini gösterir. Bilerek bağlantı yok: e-posta uygulaması bağlantıyı oturumun açık olmadığı
 * başka bir tarayıcıda açabiliyor, kullanıcı kodu doğrulama ekranındaki alana yapıştırır.
 */
export function renderCodeEmail(code: string, recipientName: string, webUrl: string) {
  const firstName = recipientName.trim().split(/\s+/)[0] ?? '';
  const host = new URL(webUrl).host;
  const subject = `Doğrulama kodun: ${code}`;
  const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#125139;padding:18px 24px;font-size:18px;font-weight:700;color:#ffffff">evdenevenakliyat<span style="color:#fcd34d">.app</span></td></tr>
<tr><td align="center" style="padding:32px 24px 8px">
<p style="margin:0 0 8px;font-size:15px">Merhaba ${escape(firstName)},</p>
<h1 style="margin:0 0 12px;font-size:20px;color:#10432f">Doğrulama kodu</h1>
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#52525b">Bu kod 10 dakika geçerlidir ve yalnızca bir kez kullanılabilir. Kodu kimseyle paylaşma; ekibimiz kodu asla sormaz.</p>
<p style="margin:0 0 12px;font-size:38px;font-weight:700;letter-spacing:4px;color:#18181b;font-family:'Courier New',Courier,monospace;background:#f0f7f3;border:2px dashed #136544;border-radius:12px;padding:14px 20px;-webkit-user-select:all;user-select:all">${code}</p>
<p style="margin:0 0 28px;font-size:13px;line-height:1.6;color:#52525b">Kodu kopyala ve doğrulama ekranındaki alana yapıştır.</p>
</td></tr>
<tr><td style="padding:20px 24px;border-top:1px solid #e4e4e7;font-size:12px;line-height:1.6;color:#71717a">
Bu kodu sen istemediysen e-postayı yok sayabilirsin; hesabında bir değişiklik yapılmaz. ${escape(host)}
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  const text = [
    `Merhaba ${firstName},`,
    '',
    `Doğrulama kodun: ${code}`,
    'Kodu kopyala ve doğrulama ekranındaki alana yapıştır.',
    '',
    'Bu kod 10 dakika geçerlidir ve yalnızca bir kez kullanılabilir. Kodu kimseyle paylaşma.',
    'Bu kodu sen istemediysen e-postayı yok sayabilirsin.',
  ].join('\n');
  return { subject, html, text };
}

/** Brevo işlem e-postası ile kod gönderir. Ortam değişkenleri bildirimlerle aynı (docs/bildirimler.md). */
export class BrevoEmailCodeSender implements CodeSender {
  readonly provider = 'brevo';

  constructor(
    private readonly apiKey: string,
    private readonly config: ConfigService,
  ) {}

  async send(to: CodeRecipient, code: string) {
    const { subject, html, text } = renderCodeEmail(
      code,
      to.fullName,
      this.config.get<string>('WEB_URL') ?? 'https://evdenevenakliyat.app',
    );
    const res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': this.apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: {
          email: this.config.get<string>('MAIL_FROM_EMAIL') ?? 'bildirim@evdenevenakliyat.app',
          name: this.config.get<string>('MAIL_FROM_NAME') ?? 'evdenevenakliyat.app',
        },
        to: [{ email: to.address, name: to.fullName }],
        subject,
        htmlContent: html,
        textContent: text,
        tags: ['VERIFICATION_CODE'],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw await failure('Brevo', res);
  }
}
