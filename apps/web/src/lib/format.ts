const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

export const formatDate = (iso: string) => dateFormat.format(new Date(iso));

const dateTimeFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

/** Türkiye saatiyle tarih ve saat: "2 Ekim 2026 14:40" */
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));

const moneyFormat = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

export const formatMoney = (value: string | number) => moneyFormat.format(Number(value));

export const floorLabel = (floor: number) =>
  floor < 0 ? "Bodrum kat" : floor === 0 ? "Zemin kat" : `${floor}. kat`;

/** "+905321234567" → "0532 123 45 67" */
export function formatPhone(phone: string): string {
  const m = phone.match(/^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/);
  return m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}

export const place = (city: string | null, district: string | null) =>
  [city, district].filter(Boolean).join(", ");
