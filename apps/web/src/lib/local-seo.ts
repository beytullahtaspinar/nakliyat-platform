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

export function localPageDescription(page: LocalPage): string {
  switch (page.kind) {
    case "city":
      return `${page.city.name} içinde ve ${page.city.name} çıkışlı taşınmanız için K3 belgeli, doğrulanmış nakliyat firmalarından ücretsiz teklif alın, fiyatları ve yorumları karşılaştırın.`;
    case "district":
      return `${page.district.name}, ${page.city.name} evden eve nakliyat: bölgede hizmet veren doğrulanmış firmalardan teklif alın, fiyat, kapsam ve müşteri yorumlarını karşılaştırın.`;
    case "route":
      return `${page.from.name} ile ${page.to.name} arası ${page.distanceKm} km şehirler arası taşınma: doğrulanmış nakliyat firmalarından teklif alın ve karşılaştırın.`;
  }
}

export { citySlug };
