/** Taşıma talebi formundaki seçenekler (API enum değerleri → Türkçe etiket) */
export const HOME_TYPES = [
  { value: "STUDIO", label: "Stüdyo (1+0)" },
  { value: "ONE_PLUS_ONE", label: "1+1" },
  { value: "TWO_PLUS_ONE", label: "2+1" },
  { value: "THREE_PLUS_ONE", label: "3+1" },
  { value: "FOUR_PLUS_ONE", label: "4+1 ve üzeri" },
  { value: "VILLA", label: "Villa / müstakil ev" },
  { value: "OFFICE", label: "Ofis / iş yeri" },
] as const;

export const homeTypeLabel = (value: string) =>
  HOME_TYPES.find((t) => t.value === value)?.label ?? value;

export const FLOORS = [
  { value: -1, label: "Bodrum kat" },
  { value: 0, label: "Zemin / bahçe katı" },
  ...Array.from({ length: 30 }, (_, i) => ({ value: i + 1, label: `${i + 1}. kat` })),
];

/** Türkiye saatine göre YYYY-MM-DD; offsetDays gün sonrası */
export function turkeyDate(offsetDays = 0, now = new Date()): string {
  const shifted = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(shifted);
}
