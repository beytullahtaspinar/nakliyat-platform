/**
 * Tahmini taşıma fiyatı modeli.
 *
 * Herkese açık fiyat hesaplayıcı (web, tarayıcıda) ve API (katsayı doğrulama, platform verisiyle ayarlama)
 * aynı hesabı bu paketten kullanır. Rakip sitelerden veri alınmaz: katsayıları yönetim belirler, platformda
 * yeterli anlaşma birikince model gerçek anlaşma fiyatlarıyla ayarlanır (calibrate).
 */

export const HOME_TYPES = [
  'STUDIO',
  'ONE_PLUS_ONE',
  'TWO_PLUS_ONE',
  'THREE_PLUS_ONE',
  'FOUR_PLUS_ONE',
  'VILLA',
  'OFFICE',
] as const;
export type HomeType = (typeof HOME_TYPES)[number];

/** Ev tipine göre ortalama eşya hacmi (m³). Talep standardı (estimatedVolumeM3) da bunu kullanır. */
export const HOME_VOLUME_M3: Record<HomeType, number> = {
  STUDIO: 10,
  ONE_PLUS_ONE: 15,
  TWO_PLUS_ONE: 25,
  THREE_PLUS_ONE: 35,
  FOUR_PLUS_ONE: 45,
  VILLA: 60,
  OFFICE: 30,
};

/** Hacme göre önerilen ekip (kişi) */
export const crewForVolume = (volumeM3: number) => (volumeM3 <= 15 ? 2 : volumeM3 <= 30 ? 3 : volumeM3 <= 45 ? 4 : 5);

/** Eşya miktarı: aynı ev tipinde az ya da çok eşya hacmi değiştirir */
export const LOAD_LEVELS = { LIGHT: 0.75, NORMAL: 1, HEAVY: 1.3 } as const;
export type LoadLevel = keyof typeof LOAD_LEVELS;

export interface PricingSettings {
  /** Her işte sabit masraf: organizasyon, temel malzeme, sigorta payı (TL) */
  baseFeeTry: number;
  /** Yükleme ve boşaltma işçiliği, m³ başına (TL) */
  laborPerM3Try: number;
  /** Asansörsüz her kat için işçilik artışı (%) */
  stairsPerFloorPct: number;
  /** Paketleme hizmeti, m³ başına (TL) */
  packingPerM3Try: number;
  /** Mobilya söküm-kurulum, m³ başına (TL) */
  assemblyPerM3Try: number;
  /** Şehir içi taşımada araç başına yol ücreti (TL) */
  localTransportTry: number;
  /** Şehirler arası taşımada araç başına km ücreti, dönüş yolu dahil (TL) */
  perKmTry: number;
  /** Bir aracın taşıyabildiği eşya hacmi (m³) */
  vehicleCapacityM3: number;
  /** Fiyat aralığının orta değerden alt ve üst sapması (%) */
  spreadPct: number;
  /** Platform verisiyle ayarlama için bir grupta gereken en az anlaşma */
  minSamples: number;
  /** Ayarlamada kullanılan anlaşmaların geriye dönük gün sayısı */
  lookbackDays: number;
}

export type PricingSettingKey = keyof PricingSettings;

export interface SettingSpec {
  label: string;
  unit: string;
  hint: string;
  min: number;
  max: number;
}

/** Katsayıların anlamı ve izin verilen aralığı: API doğrulaması ve yönetim formu aynı listeyi kullanır */
export const PRICING_SETTING_SPECS: Record<PricingSettingKey, SettingSpec> = {
  baseFeeTry: { label: 'Sabit masraf', unit: 'TL', hint: 'Her işe eklenen organizasyon, temel malzeme ve sigorta payı', min: 0, max: 100_000 },
  laborPerM3Try: { label: 'İşçilik', unit: 'TL / m³', hint: 'Yükleme ve boşaltma, asansörlü ya da zemin katta', min: 0, max: 20_000 },
  stairsPerFloorPct: { label: 'Kat farkı', unit: '% / kat', hint: 'Asansörsüz her kat için işçiliğe eklenen oran', min: 0, max: 50 },
  packingPerM3Try: { label: 'Paketleme', unit: 'TL / m³', hint: 'Müşteri paketleme hizmeti isterse', min: 0, max: 10_000 },
  assemblyPerM3Try: { label: 'Söküm ve kurulum', unit: 'TL / m³', hint: 'Müşteri mobilya söküm-kurulum isterse', min: 0, max: 10_000 },
  localTransportTry: { label: 'Şehir içi araç', unit: 'TL / araç', hint: 'Aynı il içinde taşımada araç başına yol ücreti', min: 0, max: 100_000 },
  perKmTry: { label: 'Şehirler arası km', unit: 'TL / km / araç', hint: 'İl merkezleri arası karayolu km başına, dönüş yolu dahil', min: 0, max: 1_000 },
  vehicleCapacityM3: { label: 'Araç kapasitesi', unit: 'm³', hint: 'Bu hacmi aşan taşımalarda ikinci araç hesaplanır', min: 10, max: 120 },
  spreadPct: { label: 'Aralık genişliği', unit: '±%', hint: 'Platform verisi yokken alt ve üst fiyatın orta değerden sapması', min: 5, max: 50 },
  minSamples: { label: 'Ayarlama eşiği', unit: 'anlaşma', hint: 'Şehir içi ya da şehirler arası grupta bu kadar anlaşma olunca fiyatlar platform verisine göre ayarlanır', min: 3, max: 1_000 },
  lookbackDays: { label: 'Veri dönemi', unit: 'gün', hint: 'Ayarlamada kullanılan anlaşmaların geriye dönük süresi', min: 30, max: 1_095 },
};

/** Başlangıç katsayıları (2026, TL). Yönetim ekranından değiştirilir. */
export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  baseFeeTry: 3_000,
  laborPerM3Try: 450,
  stairsPerFloorPct: 8,
  packingPerM3Try: 150,
  assemblyPerM3Try: 80,
  localTransportTry: 3_500,
  perKmTry: 45,
  vehicleCapacityM3: 50,
  spreadPct: 15,
  minSamples: 10,
  lookbackDays: 365,
};

/** Kayıtlı ayarları doğrular; eksik ya da aralık dışı değerler yerine varsayılanı koyar */
export function normalizeSettings(value: unknown): PricingSettings {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const result = { ...DEFAULT_PRICING_SETTINGS };
  for (const key of Object.keys(PRICING_SETTING_SPECS) as PricingSettingKey[]) {
    const n = source[key];
    const { min, max } = PRICING_SETTING_SPECS[key];
    if (typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max) result[key] = n;
  }
  return result;
}

// ─── Hesap ──────────────────────────────────────────────────────

export type PriceBand = 'local' | 'intercity';

export interface PriceInput {
  homeType: HomeType;
  load?: LoadLevel;
  /** İl merkezleri arası karayolu mesafesi; aynı il içindeyse boş */
  distanceKm?: number;
  fromFloor: number;
  fromHasElevator: boolean;
  toFloor: number;
  toHasElevator: boolean;
  needsPacking: boolean;
  needsAssembly: boolean;
}

export interface CalibrationBand {
  /** Gerçek anlaşma fiyatının model fiyatına oranı (ortanca) */
  factor: number;
  /** Anlaşmaların dağılımından çıkan aralık genişliği (±%) */
  spreadPct: number;
  samples: number;
}

/** Platformdaki anlaşmalarla ayarlama; yeterli veri olmayan grup yer almaz */
export type Calibration = Partial<Record<PriceBand, CalibrationBand>>;

export interface PriceEstimate {
  minTry: number;
  maxTry: number;
  midTry: number;
  volumeM3: number;
  crew: number;
  vehicles: number;
  band: PriceBand;
  /** model: yönetimin katsayıları; platform: anlaşma fiyatlarıyla ayarlanmış */
  source: 'model' | 'platform';
  /** Ayarlamada kullanılan anlaşma sayısı (source = platform) */
  samples?: number;
  /** Orta değerin kalemleri (TL, ayarlamadan önce) */
  breakdown: { base: number; labor: number; packing: number; assembly: number; transport: number };
}

const stairsFactor = (floor: number, hasElevator: boolean, pct: number) =>
  1 + (hasElevator ? 0 : Math.abs(floor) * (pct / 100));

/** Yönetimin katsayılarıyla, ayarlama uygulanmadan hesaplanan orta değer ve kalemleri */
export function modelPrice(input: PriceInput, s: PricingSettings) {
  const volumeM3 = Math.max(1, Math.round(HOME_VOLUME_M3[input.homeType] * LOAD_LEVELS[input.load ?? 'NORMAL']));
  const vehicles = Math.max(1, Math.ceil(volumeM3 / s.vehicleCapacityM3));
  const band: PriceBand = input.distanceKm ? 'intercity' : 'local';
  const stairs =
    (stairsFactor(input.fromFloor, input.fromHasElevator, s.stairsPerFloorPct) +
      stairsFactor(input.toFloor, input.toHasElevator, s.stairsPerFloorPct)) /
    2;
  const breakdown = {
    base: s.baseFeeTry,
    labor: volumeM3 * s.laborPerM3Try * stairs,
    packing: input.needsPacking ? volumeM3 * s.packingPerM3Try : 0,
    assembly: input.needsAssembly ? volumeM3 * s.assemblyPerM3Try : 0,
    // Şehirler arası yol ücreti şehir içinin altına inmez (kısa mesafe)
    transport: vehicles * (input.distanceKm ? Math.max(s.localTransportTry, input.distanceKm * s.perKmTry) : s.localTransportTry),
  };
  const total = breakdown.base + breakdown.labor + breakdown.packing + breakdown.assembly + breakdown.transport;
  return { total, volumeM3, vehicles, band, breakdown };
}

/** Fiyatlar 500 TL'ye (5.000 TL altında 100 TL'ye) yuvarlanır: tahmin olduğu kuruşla verilmez */
const step = (n: number) => (n < 5_000 ? 100 : 500);
const roundDown = (n: number) => Math.floor(n / step(n)) * step(n);
const roundUp = (n: number) => Math.ceil(n / step(n)) * step(n);
const roundTo = (n: number) => Math.round(n / step(n)) * step(n);

const rounded = (b: PriceEstimate['breakdown']) =>
  Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v)])) as PriceEstimate['breakdown'];

export function estimatePrice(input: PriceInput, settings: PricingSettings, calibration: Calibration = {}): PriceEstimate {
  const { total, volumeM3, vehicles, band, breakdown } = modelPrice(input, settings);
  const cal = calibration[band];
  const mid = total * (cal?.factor ?? 1);
  const spread = (cal?.spreadPct ?? settings.spreadPct) / 100;
  return {
    minTry: roundDown(mid * (1 - spread)),
    maxTry: roundUp(mid * (1 + spread)),
    midTry: roundTo(mid),
    volumeM3,
    crew: crewForVolume(volumeM3),
    vehicles,
    band,
    source: cal ? 'platform' : 'model',
    ...(cal && { samples: cal.samples }),
    breakdown: rounded(breakdown),
  };
}

// ─── Platform verisiyle ayarlama ────────────────────────────────

export interface PriceSample {
  input: PriceInput;
  /** Kabul edilen teklifin fiyatı (TL) */
  priceTry: number;
}

const quantile = (sorted: number[], q: number) => {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
};

/** Ayarlama oranı ve aralığı için sınırlar: birkaç uç anlaşma tahmini anlamsız hale getirmesin */
const FACTOR_LIMITS = [0.4, 2.5] as const;
const SPREAD_LIMITS = [8, 35] as const;
const clamp = (n: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, n));

/**
 * Anlaşma fiyatlarını aynı işin model fiyatıyla karşılaştırır. Her grupta (şehir içi / şehirler arası) en az
 * minSamples anlaşma varsa ortanca oran fiyatları ölçekler, oranların çeyrekler arası farkı aralığı belirler.
 */
export function calibrate(samples: PriceSample[], settings: PricingSettings): Calibration {
  const ratios: Record<PriceBand, number[]> = { local: [], intercity: [] };
  for (const { input, priceTry } of samples) {
    const { total, band } = modelPrice(input, settings);
    if (priceTry > 0 && total > 0) ratios[band].push(priceTry / total);
  }
  const result: Calibration = {};
  for (const band of ['local', 'intercity'] as const) {
    const list = ratios[band].sort((a, b) => a - b);
    if (list.length < settings.minSamples) continue;
    const median = quantile(list, 0.5);
    const iqrHalf = (quantile(list, 0.75) - quantile(list, 0.25)) / 2;
    result[band] = {
      factor: Math.round(clamp(median, FACTOR_LIMITS) * 1000) / 1000,
      spreadPct: Math.round(clamp((iqrHalf / median) * 100, SPREAD_LIMITS)),
      samples: list.length,
    };
  }
  return result;
}
