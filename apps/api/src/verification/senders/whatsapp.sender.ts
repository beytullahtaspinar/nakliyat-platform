import { failure, type CodeRecipient, type CodeSender } from './code-sender.js';

const GRAPH_URL = 'https://graph.facebook.com/v23.0';
const TIMEOUT_MS = 10_000;

export interface WhatsAppConfig {
  /** Kalıcı sistem kullanıcısı erişim anahtarı (Meta Business) */
  token: string;
  /** WhatsApp Business numarasının kimliği (Phone number ID) */
  phoneNumberId: string;
  /** Meta'da onaylı "Authentication" kategorisindeki şablonun adı */
  template: string;
  /** Şablon dili */
  language: string;
}

/**
 * WhatsApp Cloud API ile doğrulama kodu. "Authentication" şablonu gerekir; şablonda
 * "Kodu kopyala" düğmesi olur. Kurulum: docs/dogrulama.md.
 */
export class WhatsAppCodeSender implements CodeSender {
  readonly provider = 'whatsapp';

  constructor(private readonly cfg: WhatsAppConfig) {}

  async send(to: CodeRecipient, code: string) {
    const res = await fetch(`${GRAPH_URL}/${encodeURIComponent(this.cfg.phoneNumberId)}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.cfg.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.address.replace(/^\+/, ''),
        type: 'template',
        template: {
          name: this.cfg.template,
          language: { code: this.cfg.language },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
          ],
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw await failure('WhatsApp', res);
  }
}
