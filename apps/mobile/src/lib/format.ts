import type { RequestStatus } from '@nakliyat/api-client';

export const formatTry = (value: number) => `${Math.round(value).toLocaleString('tr-TR')} TL`;

/** Taşınma günü gibi tarih alanları TSİ gösterilir. */
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });

/** apps/web/src/lib/request-options.ts ile aynı etiketler */
export const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: 'info' | 'success' | 'warning' | 'muted' }> = {
  DRAFT: { label: 'Doğrulama bekliyor', tone: 'warning' },
  OPEN: { label: 'Teklif bekliyor', tone: 'info' },
  BOOKED: { label: 'Firma seçildi', tone: 'success' },
  COMPLETED: { label: 'Tamamlandı', tone: 'success' },
  CANCELLED: { label: 'İptal edildi', tone: 'muted' },
  EXPIRED: { label: 'Süresi doldu', tone: 'muted' },
};

export const placeLabel = (city: string | null, district: string | null) =>
  [district, city].filter(Boolean).join(', ') || 'Belirtilmedi';
