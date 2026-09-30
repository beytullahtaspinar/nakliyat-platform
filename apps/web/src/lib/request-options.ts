import type { RequestStatus } from "@/lib/api";

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

export const VEHICLE_LABELS: Record<string, string> = {
  PANELVAN: "Panelvan",
  KAMYONET: "Kamyonet",
  KAMYON: "Kamyon",
  TIR: "Tır",
};

export const REQUEST_STATUS: Record<RequestStatus, { label: string; className: string }> = {
  DRAFT: { label: "Taslak", className: "bg-zinc-100 text-zinc-700" },
  OPEN: { label: "Teklif bekliyor", className: "bg-blue-50 text-blue-800" },
  BOOKED: { label: "Firma seçildi", className: "bg-green-50 text-green-800" },
  COMPLETED: { label: "Tamamlandı", className: "bg-green-50 text-green-800" },
  CANCELLED: { label: "İptal edildi", className: "bg-zinc-100 text-zinc-600" },
  EXPIRED: { label: "Süresi doldu", className: "bg-zinc-100 text-zinc-600" },
};
