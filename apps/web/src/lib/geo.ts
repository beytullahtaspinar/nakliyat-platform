// Ücretsiz harita servisleri; hiçbiri anahtar istemez. Ayrıntılar: docs/harita.md
/** Vektör harita stili (OpenFreeMap, OpenStreetMap verisi) */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
/** Adres arama (Photon, OpenStreetMap verisi) */
const GEOCODER_URL = "https://photon.komoot.io";
/** Türkiye'yi kapsayan kutu: boylam, enlem, boylam, enlem. API'deki TURKEY_BOUNDS ile aynı */
const TURKEY_BBOX = "25.6,35.8,44.9,42.2";
export const TURKEY_CENTER: [number, number] = [35.2, 39.0];

export type LatLng = { lat: number; lng: number };
export type Place = LatLng & { label: string };

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: Partial<
    Record<"name" | "street" | "housenumber" | "district" | "locality" | "city" | "county" | "state", string>
  >;
};

function label({ properties: p }: PhotonFeature): string {
  const street = p.street ? [p.street, p.housenumber].filter(Boolean).join(" No:") : undefined;
  const parts = [p.name, street, p.district ?? p.locality, p.county, p.city ?? p.state];
  return [...new Set(parts.filter(Boolean))].join(", ");
}

const toPlace = (f: PhotonFeature): Place => ({
  lng: f.geometry.coordinates[0],
  lat: f.geometry.coordinates[1],
  label: label(f),
});

async function photon(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<Place[]> {
  const res = await fetch(`${GEOCODER_URL}${path}?${new URLSearchParams(params)}`, { signal });
  if (!res.ok) throw new Error(`Adres araması yanıt vermedi (${res.status})`);
  const body = (await res.json()) as { features?: PhotonFeature[] };
  return (body.features ?? []).map(toPlace);
}

/** Türkiye içinde adres arar; near verilirse o çevredeki sonuçlar öne çıkar. */
export function searchPlaces(query: string, near?: LatLng, signal?: AbortSignal): Promise<Place[]> {
  return photon(
    "/api/",
    { q: query, limit: "6", bbox: TURKEY_BBOX, ...(near && { lat: String(near.lat), lon: String(near.lng) }) },
    signal,
  );
}

/** İşaretlenen noktanın okunur adresi (bulunamazsa null) */
export async function describePoint(point: LatLng, signal?: AbortSignal): Promise<string | null> {
  const [place] = await photon("/reverse", { lat: String(point.lat), lon: String(point.lng) }, signal);
  return place?.label || null;
}

const coords = (p: LatLng) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/** Bir uç: haritada işaret varsa koordinat, yoksa yazılı adres */
export type Stop = { location: LatLng | null; text: string };

/** Google Haritalar yol tarifi; telefonda uygulamayı açar */
export function googleDirectionsUrl(from: Stop, to: Stop): string {
  const point = (s: Stop) => (s.location ? coords(s.location) : s.text);
  const params = new URLSearchParams({ api: "1", origin: point(from), destination: point(to), travelmode: "driving" });
  return `https://www.google.com/maps/dir/?${params}`;
}

/** Yandex Haritalar yol tarifi (Türkiye'de yaygın); yalnızca iki uç da işaretliyse */
export function yandexDirectionsUrl(from: LatLng, to: LatLng): string {
  return `https://yandex.com.tr/harita/?${new URLSearchParams({ rtext: `${coords(from)}~${coords(to)}`, rtt: "auto" })}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} dk`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

/** "14 km · yaklaşık 31 dk"; yol hesaplanmadıysa null */
export function routeText(r: { routeKm: number | null; routeMinutes: number | null }): string | null {
  if (r.routeKm == null) return null;
  return r.routeMinutes != null ? `${r.routeKm} km · yaklaşık ${formatDuration(r.routeMinutes)}` : `${r.routeKm} km`;
}
