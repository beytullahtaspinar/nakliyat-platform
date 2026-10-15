import type { BookingActor, BookingFollowUpState, BookingPlace, BookingStatus } from '@nakliyat/api-client';
import { formatDate } from './format';
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

const WHO: Record<BookingActor, string> = { CUSTOMER: 'Müşteri', COMPANY: 'Firma', SYSTEM: 'Sistem', ADMIN: 'Yönetim' };

/**
 * Taşınma sonrası durum metni (sitedeki BookingFollowUp ile aynı): kimse işaretlemezse ne zaman tamamlanacağı,
 * bekleyen itiraz ya da yönetimin kararı. Gösterilecek bir şey yoksa null.
 */
export function followUpText(
  b: BookingFollowUpState & { status: BookingStatus; canComplete: boolean },
  viewer: 'CUSTOMER' | 'COMPANY',
): string | null {
  if (b.status === 'SCHEDULED' && b.disputedAt) {
    const who = b.disputedBy === viewer ? 'Taşınmanın yapılmadığını bildirdin' : `${WHO[b.disputedBy ?? 'CUSTOMER']} taşınmanın yapılmadığını bildirdi`;
    return `${who} (${formatDate(b.disputedAt)}). Yönetim inceleyip karar verecek; bu sürede iş tamamlanmaz ve iptal edilemez.${b.disputeReason ? ` İtiraz: "${b.disputeReason}"` : ''}`;
  }
  if (b.disputeResolvedAt && b.disputeResolution) {
    const result = b.status === 'COMPLETED' ? 'taşınma yapılmış sayıldı' : 'taşınma yapılmadı, iş iptal edildi';
    return `Yönetim itirazı karara bağladı (${formatDate(b.disputeResolvedAt)}): ${result}. Açıklama: ${b.disputeResolution}`;
  }
  if (b.status === 'COMPLETED' && b.completedBy === 'SYSTEM') return 'Taşınma gününden sonra itiraz gelmediği için iş kendiliğinden tamamlandı.';
  if (b.status === 'SCHEDULED' && b.canComplete && b.autoCompleteOn) {
    return `Taşınma yapıldıysa işi tamamlandı olarak işaretle. Kimse işaretlemez ve itiraz gelmezse iş ${formatDate(`${b.autoCompleteOn}T00:00:00.000Z`)} tarihinde kendiliğinden tamamlanır.`;
  }
  return null;
}
