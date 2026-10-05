/**
 * Yasal metinlerin ortak bilgileri.
 *
 * Platform bir şahıs işletmesi tarafından işletilir (ticaret unvanı ve MERSİS kaydı yok).
 * T.C. kimlik numarası hiçbir metinde yayınlanmaz ve burada tutulmaz; vergi kimlik numarası yeterlidir.
 * Avukat kontrol listesi: docs/yasal-metinler.md.
 *
 * LEGAL_VERSION, kayıtta kullanıcının kabul ettiği sürüm olarak API'ye gönderilir ve saklanır.
 * Koşullarda esaslı bir değişiklik yapıldığında hem bu sürüm hem LEGAL_UPDATED güncellenir.
 */
export const LEGAL_VERSION = "2026-10-05";
export const LEGAL_UPDATED = "5 Ekim 2026";

export const COMPANY = {
  /** Veri sorumlusu ve hizmet sağlayıcı (şahıs işletmesi sahibi) */
  title: "Mehtap Yılmaz",
  address: "Cumhuriyet Mah. 3. Sigorta Cad. B Blok No: 14/1 İç Kapı No: 7 Merkez/Uşak",
  taxInfo: "Uşak Vergi Dairesi, VKN 9730705619",
  /** KVKK başvuruları için */
  kvkkEmail: "kvkk@evdenevenakliyat.app",
  /** Genel destek ve şikâyetler için */
  supportEmail: "destek@evdenevenakliyat.app",
  site: "evdenevenakliyat.app",
} as const;

/** Şirket bilgileri girildi mi? Yer tutucular tanıtım sayfalarında gösterilmez. */
export const COMPANY_INFO_READY = !COMPANY.title.startsWith("[");

export const LEGAL_LINKS = [
  { href: "/kullanim-kosullari", label: "Kullanım koşulları" },
  { href: "/kvkk-aydinlatma-metni", label: "KVKK aydınlatma metni" },
  { href: "/gizlilik-politikasi", label: "Gizlilik politikası" },
  { href: "/cerez-politikasi", label: "Çerez politikası" },
  { href: "/acik-riza-metni", label: "Açık rıza metni" },
] as const;

/**
 * Kayıt formundaki onaylardan API'ye gidecek alanlar. Sürüm, formu gösteren sunucudaki güncel metindir;
 * API kabul anını bu sürümle birlikte saklar. Zorunlu kutu ("kvkk") ayrıca eylemde kontrol edilir.
 */
export function consentPayload(formData: FormData) {
  return { termsVersion: LEGAL_VERSION, marketingConsent: formData.get("marketingConsent") === "on" };
}
