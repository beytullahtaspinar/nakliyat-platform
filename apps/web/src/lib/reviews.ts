/** Değerlendirme ve firma sayfası yardımcıları */

export const RATING_LABELS: Record<number, string> = { 1: "Çok kötü", 2: "Kötü", 3: "Orta", 4: "İyi", 5: "Çok iyi" };

/** Firma sayfası verisinin önbellek etiketi: yorum eklenince/gizlenince süresi bitirilir */
export const COMPANY_CACHE_TAG = "firmalar";

export const COMMENT_MIN_LENGTH = 10;
export const COMMENT_MAX_LENGTH = 2000;
export const REPLY_MAX_LENGTH = 1000;

const TR_MAP: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** "Öz Güneş Nakliyat" → "oz-gunes-nakliyat" */
export function slugify(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşüâîû]/g, (ch) => TR_MAP[ch] ?? ch)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/**
 * Firma sayfasının yolu: /firmalar/oz-gunes-nakliyat-<kimlik>. Ad değişse de kimlik aynı kalır;
 * eski adres yeni adrese yönlenir.
 */
export const companyPath = (company: { id: string; displayName: string }) =>
  `/firmalar/${[slugify(company.displayName), company.id].filter(Boolean).join("-")}`;

/** Adresin son parçası firma kimliğidir (cuid, tire içermez) */
export const companyIdFromSlug = (slug: string) => slug.split("-").at(-1) ?? "";

/** 4.666 → "4,7" */
export const formatRating = (value: string | number) =>
  Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
