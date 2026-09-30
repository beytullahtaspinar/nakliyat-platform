import { CITY_RECORDS, DISTANCES_KM } from './data.js';
import type { CityRecord, DistrictRecord } from './types.js';

export type { CityRecord, DistrictRecord } from './types.js';

const citiesBySlug = new Map(CITY_RECORDS.map((c) => [c.slug, c]));
const citiesByCode = new Map(CITY_RECORDS.map((c) => [c.code, c]));

/** Tüm iller, Türkçe alfabetik sırada */
export function getCities(): CityRecord[] {
  return CITY_RECORDS;
}

export function getCityBySlug(slug: string): CityRecord | undefined {
  return citiesBySlug.get(slug);
}

export function getCityByCode(code: string): CityRecord | undefined {
  return citiesByCode.get(code);
}

export function getDistrict(city: CityRecord, districtSlug: string): DistrictRecord | undefined {
  return city.districts.find((d) => d.slug === districtSlug);
}

/** İki il arasındaki karayolu mesafesi (km) */
export function getDistanceKm(from: CityRecord, to: CityRecord): number | undefined {
  return DISTANCES_KM[from.code]?.[to.code];
}

/** Bir ile en yakın iller, mesafeye göre sıralı */
export function getNearestCities(city: CityRecord, limit = 6): { city: CityRecord; distanceKm: number }[] {
  return Object.entries(DISTANCES_KM[city.code] ?? {})
    .sort(([, a], [, b]) => a - b)
    .slice(0, limit)
    .map(([code, distanceKm]) => ({ city: citiesByCode.get(code)!, distanceKm }));
}

// ─── SEO adresleri ──────────────────────────────────────────────

export const LOCAL_SUFFIX = 'evden-eve-nakliyat';
export const ROUTE_SUFFIX = 'sehirler-arasi-nakliyat';

export type LocalPage =
  | { kind: 'city'; slug: string; city: CityRecord }
  | { kind: 'district'; slug: string; city: CityRecord; district: DistrictRecord }
  | { kind: 'route'; slug: string; from: CityRecord; to: CityRecord; distanceKm: number };

export const citySlug = (city: CityRecord) => `${city.slug}-${LOCAL_SUFFIX}`;
export const districtSlug = (city: CityRecord, district: DistrictRecord) =>
  `${city.slug}-${district.slug}-${LOCAL_SUFFIX}`;
export const routeSlug = (from: CityRecord, to: CityRecord) =>
  `${from.slug}-${to.slug}-${ROUTE_SUFFIX}`;

/**
 * Adres parçasını çözer:
 *   istanbul-evden-eve-nakliyat               → il sayfası
 *   istanbul-kadikoy-evden-eve-nakliyat       → ilçe sayfası
 *   istanbul-ankara-sehirler-arasi-nakliyat   → şehirler arası sayfa
 * Tanınmayan adreste undefined döner.
 */
export function resolveLocalPage(slug: string): LocalPage | undefined {
  if (slug.endsWith(`-${ROUTE_SUFFIX}`)) {
    const [fromSlug, toSlug, ...rest] = slug.slice(0, -ROUTE_SUFFIX.length - 1).split('-');
    const from = fromSlug ? citiesBySlug.get(fromSlug) : undefined;
    const to = toSlug ? citiesBySlug.get(toSlug) : undefined;
    if (!from || !to || rest.length || from === to) return undefined;
    return { kind: 'route', slug, from, to, distanceKm: getDistanceKm(from, to)! };
  }

  if (!slug.endsWith(`-${LOCAL_SUFFIX}`)) return undefined;
  const place = slug.slice(0, -LOCAL_SUFFIX.length - 1);
  const [cityPart, ...districtParts] = place.split('-');
  const city = cityPart ? citiesBySlug.get(cityPart) : undefined;
  if (!city) return undefined;
  if (!districtParts.length) return { kind: 'city', slug, city };
  const district = getDistrict(city, districtParts.join('-'));
  return district ? { kind: 'district', slug, city, district } : undefined;
}

/** Tüm il, ilçe ve şehirler arası sayfa adresleri */
export function getAllLocalPages(): LocalPage[] {
  const pages: LocalPage[] = [];
  for (const city of CITY_RECORDS) {
    pages.push({ kind: 'city', slug: citySlug(city), city });
    for (const district of city.districts) {
      pages.push({ kind: 'district', slug: districtSlug(city, district), city, district });
    }
  }
  for (const from of CITY_RECORDS) {
    for (const to of CITY_RECORDS) {
      if (from !== to) {
        pages.push({ kind: 'route', slug: routeSlug(from, to), from, to, distanceKm: getDistanceKm(from, to)! });
      }
    }
  }
  return pages;
}
