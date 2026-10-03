import { BadRequestException } from '@nestjs/common';

/**
 * Firma tanıtım sayfası kuralları. Web tarafındaki karşılığı: apps/web/src/lib/showcase.ts
 */

/** Firmanın seçebileceği hizmetler (etiketler web tarafında) */
export const SERVICE_CODES = [
  'EVDEN_EVE',
  'SEHIRLER_ARASI',
  'OFIS',
  'PARCA_ESYA',
  'ASANSORLU',
  'PAKETLEME',
  'MONTAJ',
  'DEPOLAMA',
  'PIYANO',
  'SIGORTALI',
] as const;
export type ServiceCode = (typeof SERVICE_CODES)[number];

export const SHOWCASE_RULES = {
  maxPhotos: 12,
  /** Tarayıcıda küçültülmüş dosyalar için güvenlik payı */
  photoMaxBytes: 2 * 1024 * 1024,
  thumbMaxBytes: 400 * 1024,
  logoMaxBytes: 300 * 1024,
  mimeTypes: ['image/webp', 'image/jpeg'],
  descriptionMax: 3000,
  captionMax: 120,
} as const;

/**
 * Yorumu olmayan firmanın sayfası şu koşulla arama motoruna açılır: en az 300 karakter tanıtım yazısı
 * ve en az 2 fotoğraf (yönetimin gizlemedikleri). Daha azı "ince içerik" sayılır.
 */
export const INDEX_RULES = { minDescription: 300, minPhotos: 2 } as const;

export const isShowcaseComplete = (description: string | null, visiblePhotos: number) =>
  (description?.trim().length ?? 0) >= INDEX_RULES.minDescription && visiblePhotos >= INDEX_RULES.minPhotos;

/**
 * Tanıtım yazısında iletişim bilgisi var mı: telefon (araya boşluk/tire/nokta girse de),
 * e-posta, web adresi. Müşteri ile firma platform dışında anlaşmasın diye iletişim bilgisi
 * teklif kabul edilince açılır.
 */
export function findContactInfo(text: string): 'telefon' | 'e-posta' | 'web adresi' | null {
  if (/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+\.[\p{L}]{2,}/u.test(text)) return 'e-posta';
  if (/(https?:\/\/|www\.)|\b[\p{L}\p{N}-]+\.(com|net|org|info|biz|app|com\.tr|net\.tr|tr)\b/iu.test(text)) {
    return 'web adresi';
  }
  // Binlik ayraçlı tutarlar ("15.000 - 45.000 TL") telefon sayılmaz
  const withoutAmounts = text.replace(/(?<![\d.])\d{1,3}(?:\.\d{3})+(?:,\d+)?(?![\d.])/g, ' ');
  // Rakam dizileri: arada boşluk, tire, nokta, parantez olabilir ("0532 123 45 67", "(0212) 555-12-12").
  // Türkiye numarası: 10 hane (2-5 ile başlar), başında 0 ya da 90 olabilir
  for (const run of withoutAmounts.match(/[+(]?\d[\d\s().-]{8,}\d/g) ?? []) {
    const digits = run.replace(/\D/g, '');
    // 12 haneden uzun dizi: büyük olasılıkla art arda yazılmış birden çok numara
    if (/^(?:90)?0?[2-5]\d{9}$/.test(digits) || digits.length > 12) return 'telefon';
  }
  return null;
}

/** Kayıttaki hizmet listesi (JSON), sabit sırada; bilinmeyen kodlar atılır */
export const servicesOf = (services: unknown): ServiceCode[] =>
  Array.isArray(services) ? SERVICE_CODES.filter((code) => services.includes(code)) : [];

/** Tanıtım yazısındaki iletişim bilgisi hatası; firma profilinde ve tanıtım sayfasında aynı */
export function assertNoContactInfo(text: string | null | undefined, field: string) {
  const found = text ? findContactInfo(text) : null;
  if (found) {
    throw new BadRequestException(
      `${field} ${found} içeremez. İletişim bilgilerin, müşteri teklifini kabul edince ona otomatik iletilir.`,
    );
  }
}
