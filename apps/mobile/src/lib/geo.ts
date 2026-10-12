// Sitedeki apps/web/src/lib/geo.ts ile aynı ücretsiz servisler; hiçbiri anahtar istemez. Ayrıntılar: docs/harita.md

/** Vektör harita stili (OpenFreeMap, OpenStreetMap verisi) */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
/** Adres arama (Photon, OpenStreetMap verisi) */
const GEOCODER_URL = 'https://photon.komoot.io';
/** Türkiye'yi kapsayan kutu: boylam, enlem, boylam, enlem. API'deki TURKEY_BOUNDS ile aynı */
const TURKEY_BBOX = '25.6,35.8,44.9,42.2';
export const TURKEY_CENTER = { lat: 39.0, lng: 35.2 };

export type LatLng = { lat: number; lng: number };
/** label: tam okunur ad; street: il ve ilçe olmadan mahalle, sokak ve bina (açık adres alanı için) */
export type Place = LatLng & { label: string; street: string };

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: Partial<Record<'name' | 'street' | 'housenumber' | 'district' | 'locality' | 'city' | 'county' | 'state', string>>;
};

const join = (parts: (string | undefined)[]) => [...new Set(parts.filter(Boolean))].join(', ');
const streetNo = (p: PhotonFeature['properties']) => (p.street ? [p.street, p.housenumber].filter(Boolean).join(' No:') : undefined);

const toPlace = ({ geometry, properties: p }: PhotonFeature): Place => {
  const area = [p.county, p.city, p.state];
  return {
    lng: geometry.coordinates[0],
    lat: geometry.coordinates[1],
    label: join([p.name, streetNo(p), p.district ?? p.locality, p.county, p.city ?? p.state]),
    street: join([p.district ?? p.locality, streetNo(p), p.name].filter((x) => !area.includes(x))),
  };
};

// Hermes'te URLSearchParams eksik; sorgu elle kurulur
const query = (params: Record<string, string>) =>
  Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

async function photon(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<Place[]> {
  const res = await fetch(`${GEOCODER_URL}${path}?${query(params)}`, { signal });
  if (!res.ok) throw new Error('Adres araması şu an yanıt vermiyor.');
  const body = (await res.json()) as { features?: PhotonFeature[] };
  return (body.features ?? []).map(toPlace);
}

/** Türkiye içinde adres arar; near verilirse o çevredeki sonuçlar öne çıkar */
export function searchPlaces(text: string, near?: LatLng, signal?: AbortSignal): Promise<Place[]> {
  return photon(
    '/api/',
    { q: text, limit: '6', bbox: TURKEY_BBOX, ...(near && { lat: String(near.lat), lon: String(near.lng) }) },
    signal,
  );
}

/** İşaretlenen noktanın adresi (bulunamazsa null) */
export async function describePoint(point: LatLng, signal?: AbortSignal): Promise<Place | null> {
  const [place] = await photon('/reverse', { lat: String(point.lat), lon: String(point.lng) }, signal);
  return place?.label ? place : null;
}
