/**
 * Doğrulama kodunu ileten sağlayıcı (Brevo e-posta, Netgsm SMS, WhatsApp...).
 * Bildirim kanallarından ayrıdır: kullanıcının bildirim tercihleri doğrulama kodunu engellemez.
 * Gönderilemezse hata fırlatır; kod veritabanından silinir ve kullanıcı yeniden isteyebilir.
 */
export interface CodeSender {
  /** Loglarda ve durum ekranında görünen sağlayıcı adı */
  readonly provider: string;
  send(to: CodeRecipient, code: string, purpose?: CodePurpose): Promise<void>;
}

/** Kodun amacı: hesap doğrulama (varsayılan) ya da "şifremi unuttum". E-postanın başlığı ve metni buna göre değişir. */
export type CodePurpose = 'verify' | 'password-reset';

export interface CodeRecipient {
  /** E-posta adresi ya da +905XXXXXXXXX telefon */
  address: string;
  fullName: string;
}

/** Yapılandırılmış e-posta göndericisi; yoksa null (e-posta doğrulaması yapılamaz) */
export const EMAIL_CODE_SENDER = Symbol('EMAIL_CODE_SENDER');
/** Yapılandırılmış telefon göndericisi; yoksa null (telefon doğrulaması zorunlu tutulmaz) */
export const PHONE_CODE_SENDER = Symbol('PHONE_CODE_SENDER');

/** Hata mesajına sağlayıcının yanıtından kısa bir parça koyar (anahtar içermez). */
export async function failure(provider: string, res: Response): Promise<Error> {
  const detail = (await res.text().catch(() => '')).slice(0, 300);
  return new Error(`${provider} ${res.status}: ${detail}`);
}
