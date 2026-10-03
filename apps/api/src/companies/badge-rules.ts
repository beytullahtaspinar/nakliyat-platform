/**
 * Firma rozetleri: müşterinin teklifleri karşılaştırırken firmaya güvenmesini kolaylaştıran üç işaret.
 * Rozetler saklanmaz, her istekte güncel veriden hesaplanır. Ayrıntı: docs/firma-rozetleri.md
 * Web tarafındaki metinler: apps/web/src/lib/badges.ts
 */
export const BADGE_CODES = ['DOCUMENTS_VERIFIED', 'FAST_RESPONSE', 'TOP_RATED'] as const;
export type BadgeCode = (typeof BADGE_CODES)[number];

export const BADGE_RULES = {
  /** Hızlı yanıt: son 90 günde en az 5 teklif, talebin yayına girmesinden teklife kadar geçen ortanca süre ≤ 3 saat */
  fastResponse: { windowDays: 90, minQuotes: 5, maxMedianMinutes: 180 },
  /** Yüksek puan: yayındaki en az 5 yorumda ortalama ≥ 4,5 */
  topRated: { minAverage: 4.5, minCount: 5 },
} as const;

/** Ortanca (çift sayıda değerde ortadaki ikisinin ortalaması); boş listede null */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export type FastResponseStats = { quoteCount: number; medianMinutes: number | null };

export const earnsFastResponse = ({ quoteCount, medianMinutes }: FastResponseStats) =>
  quoteCount >= BADGE_RULES.fastResponse.minQuotes &&
  medianMinutes !== null &&
  medianMinutes <= BADGE_RULES.fastResponse.maxMedianMinutes;

export const earnsTopRated = (ratingAverage: number, ratingCount: number) =>
  ratingCount >= BADGE_RULES.topRated.minCount && ratingAverage >= BADGE_RULES.topRated.minAverage;
