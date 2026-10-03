import { MARKETING_PAGES } from "@/lib/marketing";
import type { Calibration, HomeType, LoadLevel, PricingSettings } from "@nakliyat/pricing";

/**
 * Fiyat hesaplayıcı: sayfa adresi, önbellek etiketi, etiketler ve talep formuna aktarılan alanlar.
 * Tarayıcıda da kullanılır; API istemcisini içe aktarmaz.
 */
export const PRICE_CALCULATOR_PATH = MARKETING_PAGES.priceCalculator.href;

/** Katsayılar değişince yönetim eylemi bu etiketle sayfayı hemen yeniler (updateTag) */
export const PRICING_CACHE_TAG = "fiyat";

/** GET /v1/pricing yanıtı */
export type PricingModel = {
  settings: PricingSettings;
  calibration: Calibration;
  updatedAt: string | null;
};

/** GET /v1/admin/pricing yanıtı */
export type AdminPricingView = PricingModel & {
  defaults: PricingSettings;
  sampleCounts: { local: number; intercity: number };
};

export const LOAD_OPTIONS: { value: LoadLevel; label: string; hint: string }[] = [
  { value: "LIGHT", label: "Az eşya", hint: "Sade, az mobilyalı ev" },
  { value: "NORMAL", label: "Ortalama", hint: "Ev tipine göre olağan miktar" },
  { value: "HEAVY", label: "Çok eşya", hint: "Dolu dolaplar, ek mobilya, çok koli" },
];

/** Hesaplayıcının girdileri; talep formuna aynı adla aktarılır */
export type CalculatorInput = {
  from: string;
  to: string;
  homeType: HomeType;
  load: LoadLevel;
  fromFloor: number;
  fromHasElevator: boolean;
  toFloor: number;
  toHasElevator: boolean;
  needsPacking: boolean;
  needsAssembly: boolean;
};

/**
 * Talep formunu hesaplayıcıdaki bilgilerle açan adres. Parametreleri talep-olustur/page.tsx okur;
 * hesaplayıcı adresi de aynı parametreleri kabul eder (il sayfalarından gelen bağlantılar).
 */
export function requestPrefillQuery(input: CalculatorInput): string {
  const q = new URLSearchParams({
    nereden: input.from,
    nereye: input.to,
    ev: input.homeType,
    kat: String(input.fromFloor),
    varisKat: String(input.toFloor),
  });
  if (input.fromHasElevator) q.set("asansor", "1");
  if (input.toHasElevator) q.set("varisAsansor", "1");
  if (input.needsPacking) q.set("paket", "1");
  if (input.needsAssembly) q.set("montaj", "1");
  return q.toString();
}

/** Hesaplayıcı bağlantısı: il ve şehirler arası sayfalardan güzergâh dolu gelir */
export const calculatorHref = (from: string, to: string) =>
  `${PRICE_CALCULATOR_PATH}?${new URLSearchParams({ nereden: from, nereye: to })}`;

/** "15.000 TL" (tahminler kuruşsuz ve TL ekiyle, metin içinde okunur kalsın) */
export const formatTry = (value: number) => `${value.toLocaleString("tr-TR")} TL`;

/** Hesaplayıcının ilk değerleri: sayfa bu bilgilerle önceden çizilir */
export const DEFAULT_INPUT: CalculatorInput = {
  from: "34",
  to: "34",
  homeType: "TWO_PLUS_ONE",
  load: "NORMAL",
  fromFloor: 2,
  fromHasElevator: true,
  toFloor: 2,
  toHasElevator: true,
  needsPacking: false,
  needsAssembly: false,
};

/**
 * İl merkezleri arası mesafeler sayfaya üst üçgen dizi olarak gömülür (81 il → 3.240 sayı); n ilin bu dizisinde
 * i < j çiftinin yeri.
 */
export const pairIndex = (i: number, j: number, n: number) => i * n - (i * (i + 1)) / 2 + (j - i - 1);
