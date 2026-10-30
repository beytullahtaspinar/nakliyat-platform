import {
  citySlug,
  getAllLocalPages,
  getCityBySlug,
  type CityRecord,
  type LocalPage,
} from "@nakliyat/locations";

/**
 * Lansman illeri. Bu illerin ilçe sayfaları ve aralarındaki şehirler arası sayfalar
 * arama motorlarına açılır. Diğer ilçe ve rota sayfaları çalışır ama `noindex` kalır;
 * böylece binlerce benzer sayfa yüzünden "ince içerik / doorway" cezası riski oluşmaz.
 * Bir bölgede gerçek teklif verisi biriktikçe liste genişletilir (NEXT_PUBLIC_LAUNCH_CITIES).
 */
const LAUNCH_CITY_SLUGS = (
  process.env.NEXT_PUBLIC_LAUNCH_CITIES ?? "istanbul,ankara,izmir,bursa,kocaeli,antalya"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const LAUNCH_CITIES: CityRecord[] = LAUNCH_CITY_SLUGS.map((slug) => {
  const city = getCityBySlug(slug);
  if (!city) throw new Error(`Bilinmeyen lansman ili: ${slug}`);
  return city;
});

const isLaunchCity = (city: CityRecord) => LAUNCH_CITIES.includes(city);

/** Sayfa arama motorlarında dizine eklensin mi? */
export function isIndexable(page: LocalPage): boolean {
  switch (page.kind) {
    case "city":
      return true;
    case "district":
      return isLaunchCity(page.city);
    case "route":
      return isLaunchCity(page.from) && isLaunchCity(page.to);
  }
}

export function getIndexableLocalPages(): LocalPage[] {
  return getAllLocalPages().filter(isIndexable);
}

export function localPageTitle(page: LocalPage): string {
  switch (page.kind) {
    case "city":
      return `${page.city.name} Evden Eve Nakliyat`;
    case "district":
      return `${page.district.name} Evden Eve Nakliyat (${page.city.name})`;
    case "route":
      return `${page.from.name} ${page.to.name} Evden Eve Nakliyat`;
  }
}

/**
 * Türkçe bulunma eki, kesme işaretiyle: Bursa'da, İzmir'de, Muş'ta, Bitlis'te.
 * Son ünlü kalın ise -da, ince ise -de; sert ünsüzle (f s t k ç ş h p) bitiyorsa -ta / -te.
 */
export function locative(name: string): string {
  const lower = name.toLocaleLowerCase("tr-TR");
  const vowels = [...lower].filter((ch) => "aeıioöuü".includes(ch));
  const back = "aıou".includes(vowels.at(-1) ?? "a");
  const hard = "fstkçşhp".includes(lower.at(-1) ?? "");
  return `${name}'${hard ? "t" : "d"}${back ? "a" : "e"}`;
}

/** Türkiye saatine göre içinde bulunulan yıl (başlıklarda "Fiyatları 2026") */
export const currentYear = (now = new Date()) =>
  Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric" }).format(now));

/** Arama sonucunda görünen başlık (title). Sayfa başlığı (H1) localPageTitle olarak kalır. */
export function localPageMetaTitle(page: LocalPage, year = currentYear()): string {
  switch (page.kind) {
    case "city":
      return `${page.city.name} Evden Eve Nakliyat Fiyatları ${year}`;
    case "district":
      return `${page.district.name} Evden Eve Nakliyat Fiyatları ${year} (${page.city.name})`;
    case "route":
      return `${page.from.name} ${page.to.name} Evden Eve Nakliyat Fiyatları ${year}`;
  }
}

const FACTORS_TEXT = "eşya miktarı, kat, asansör, paketleme ve mesafeye göre değişir";

export function localPageDescription(page: LocalPage, year = currentYear()): string {
  switch (page.kind) {
    case "city":
      return `${locative(page.city.name)} evden eve nakliyat fiyatları; ${FACTORS_TEXT}. ${year} tahmini fiyatları görün, doğrulanmış firmalardan ücretsiz teklif alın.`;
    case "district":
      return `${locative(page.district.name)} (${page.city.name}) evden eve nakliyat fiyatları; ${FACTORS_TEXT}. ${year} tahmini fiyatları görün, doğrulanmış firmalardan ücretsiz teklif alın.`;
    case "route":
      return `${page.from.name} ${page.to.name} arası ${page.distanceKm} km evden eve nakliyat fiyatları; eşya miktarı, kat, asansör ve paketlemeye göre değişir. ${year} tahmini fiyatları görün, firmalardan teklif alın.`;
  }
}

export { citySlug };
