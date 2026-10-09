import type { CompanyRequestView, OwnQuote, QuoteStatus, VehicleType } from '@nakliyat/api-client';

// Etiketler ve kurallar sitedeki firma paneliyle aynı: apps/web/src/lib/request-options.ts,
// apps/web/src/app/firma-paneli/request-bits.tsx. Birini değiştirirken ötekini de güncelle.

const HOME_TYPES: Record<string, string> = {
  STUDIO: 'Stüdyo (1+0)',
  ONE_PLUS_ONE: '1+1',
  TWO_PLUS_ONE: '2+1',
  THREE_PLUS_ONE: '3+1',
  FOUR_PLUS_ONE: '4+1 ve üzeri',
  VILLA: 'Villa / müstakil ev',
  OFFICE: 'Ofis / iş yeri',
};

export const homeTypeLabel = (value: string) => HOME_TYPES[value] ?? value;

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  PANELVAN: 'Panelvan',
  KAMYONET: 'Kamyonet',
  KAMYON: 'Kamyon',
  TIR: 'Tır',
};

export const floorLabel = (floor: number) => (floor < 0 ? 'Bodrum kat' : floor === 0 ? 'Zemin kat' : `${floor}. kat`);

export const place = (city: string | null, district: string | null) => [city, district].filter(Boolean).join(', ');

export const route = (r: Pick<CompanyRequestView, 'fromCityName' | 'fromDistrictName' | 'toCityName' | 'toDistrictName'>) =>
  `${place(r.fromCityName, r.fromDistrictName)} → ${place(r.toCityName, r.toDistrictName)}`;

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} dk`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

/** Yol uzunluğu; harita yolu yoksa düz mesafe, o da yoksa şehir içi */
export function distanceText(r: Pick<CompanyRequestView, 'routeKm' | 'routeMinutes' | 'distanceKm'>) {
  if (r.routeKm != null) return r.routeMinutes != null ? `${r.routeKm} km · yaklaşık ${formatDuration(r.routeMinutes)}` : `${r.routeKm} km`;
  return r.distanceKm ? `${r.distanceKm} km` : 'Şehir içi';
}

/** Türkiye saatiyle YYYY-MM-DD */
const turkeyDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(d);

/** Taşınma gününe kalan gün (Türkiye saatiyle; bugün 0) */
export function daysUntil(iso: string, now = new Date()) {
  return Math.round((Date.parse(turkeyDay(new Date(iso))) - Date.parse(turkeyDay(now))) / 86_400_000);
}

export function daysText(days: number) {
  if (days < 0) return 'tarihi geçti';
  if (days === 0) return 'bugün';
  if (days === 1) return 'yarın';
  return `${days} gün sonra`;
}

/** Asansörsüz bu kattan (dahil) yukarısı fiyatı belirgin etkiler */
export const isHeavyFloor = (floor: number, elevator: boolean) => !elevator && floor >= 2;

export type Tone = 'warning' | 'accent' | 'brand' | 'neutral' | 'success';
export type RequestFlag = { key: string; label: string; tone: Tone };

export function servicesOf(r: Pick<CompanyRequestView, 'needsPacking' | 'needsAssembly' | 'needsStorage'>): string[] {
  return [r.needsPacking && 'Paketleme', r.needsAssembly && 'Söküm/kurulum', r.needsStorage && 'Depolama'].filter(Boolean) as string[];
}

/** Talebin gözden kaçmaması gereken yanları, önem sırasıyla */
export function requestFlags(r: CompanyRequestView & { mediaCount?: number }, now = new Date()): RequestFlag[] {
  const flags: RequestFlag[] = [];
  const days = daysUntil(r.moveDate, now);
  if (days <= 3) flags.push({ key: 'acil', label: `Acil: ${daysText(days)}`, tone: 'warning' });
  if (isHeavyFloor(r.fromFloor, r.fromHasElevator))
    flags.push({ key: 'cikis-kat', label: `Çıkış: asansörsüz ${floorLabel(r.fromFloor)}`, tone: 'warning' });
  if (isHeavyFloor(r.toFloor, r.toHasElevator))
    flags.push({ key: 'varis-kat', label: `Varış: asansörsüz ${floorLabel(r.toFloor)}`, tone: 'warning' });
  if (r.specialItems.length > 0) {
    const [first, ...rest] = r.specialItems;
    flags.push({ key: 'ozel', label: `Özel eşya: ${first}${rest.length > 0 ? ` +${rest.length}` : ''}`, tone: 'warning' });
  }
  for (const service of servicesOf(r)) flags.push({ key: service, label: service, tone: 'accent' });
  if (r.fromCityCode !== r.toCityCode) flags.push({ key: 'sehirlerarasi', label: 'Şehirler arası', tone: 'brand' });
  if (r.notes) flags.push({ key: 'not', label: 'Müşteri notu var', tone: 'neutral' });
  if (r.mediaCount) flags.push({ key: 'medya', label: `${r.mediaCount} fotoğraf/video`, tone: 'neutral' });
  return flags;
}

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Teklifin bekliyor', tone: 'brand' },
  ACCEPTED: { label: 'Kabul edildi', tone: 'success' },
  REJECTED: { label: 'Başka firma seçildi', tone: 'neutral' },
  WITHDRAWN: { label: 'Geri çektin', tone: 'neutral' },
  EXPIRED: { label: 'Süresi doldu', tone: 'neutral' },
};

export const formatMoney = (value: string | number) => `${Math.round(Number(value)).toLocaleString('tr-TR')} TL`;

export const formatCredits = (n: number) => `${n.toLocaleString('tr-TR')} kredi`;

/** Teklif rozeti metni: bekleyen ve kabul edilende tutar da yazar */
export function quoteBadgeText(quote: Pick<OwnQuote, 'status' | 'priceTry'>) {
  const { label } = QUOTE_STATUS[quote.status];
  return quote.status === 'PENDING' || quote.status === 'ACCEPTED' ? `${label} · ${formatMoney(quote.priceTry)}` : label;
}
