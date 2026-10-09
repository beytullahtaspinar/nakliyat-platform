import type { BookingPlace, BookingStatus } from '@nakliyat/api-client';
import type { Tone } from './requests';

// apps/web/src/app/firma-paneli/booking-bits.tsx ve apps/web/src/lib/geo.ts ile aynı

export const BOOKING_STATUS: Record<BookingStatus, { label: string; tone: Tone }> = {
  SCHEDULED: { label: 'Planlandı', tone: 'brand' },
  COMPLETED: { label: 'Tamamlandı', tone: 'success' },
  CANCELLED: { label: 'İptal edildi', tone: 'neutral' },
};

type Place = { cityName: string | null; districtName: string | null };
const placeText = (p: Place) => [p.cityName, p.districtName].filter(Boolean).join(', ');
export const bookingRoute = (from: Place, to: Place) => `${placeText(from)} → ${placeText(to)}`;

/** "+905321234567" → "0532 123 45 67" */
export function formatPhone(phone: string): string {
  const m = phone.match(/^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/);
  return m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}

const stopText = (s: BookingPlace) => [s.address, s.districtName, s.cityName].filter(Boolean).join(', ');
const point = (s: BookingPlace) => (s.location ? `${s.location.lat.toFixed(6)},${s.location.lng.toFixed(6)}` : stopText(s));

/** Google Haritalar yol tarifi; telefonda Haritalar uygulamasını açar */
export function directionsUrl(from: BookingPlace, to: BookingPlace) {
  const q = (v: string) => encodeURIComponent(v);
  return `https://www.google.com/maps/dir/?api=1&origin=${q(point(from))}&destination=${q(point(to))}&travelmode=driving`;
}

/** Tek bir adresi haritada aç */
export function mapUrl(s: BookingPlace) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(point(s))}`;
}

const timeFormat = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Istanbul',
});

/** Mesaj zamanı, TSİ: "9 Eki 14:05" */
export const formatMessageTime = (iso: string) => timeFormat.format(new Date(iso));
