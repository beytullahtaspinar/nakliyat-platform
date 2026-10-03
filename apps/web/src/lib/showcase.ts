/**
 * Firma tanıtım sayfası: hizmet etiketleri ve görsel boyutları.
 * API'deki karşılığı: apps/api/src/companies/showcase-rules.ts
 */

export const SERVICES = [
  { code: "EVDEN_EVE", label: "Evden eve nakliyat" },
  { code: "SEHIRLER_ARASI", label: "Şehirler arası nakliyat" },
  { code: "OFIS", label: "Ofis ve iş yeri taşıma" },
  { code: "PARCA_ESYA", label: "Parça eşya taşıma" },
  { code: "ASANSORLU", label: "Asansörlü (dış cephe) taşıma" },
  { code: "PAKETLEME", label: "Profesyonel paketleme" },
  { code: "MONTAJ", label: "Mobilya söküm ve kurulum" },
  { code: "DEPOLAMA", label: "Eşya depolama" },
  { code: "PIYANO", label: "Piyano ve hassas eşya taşıma" },
  { code: "SIGORTALI", label: "Sigortalı taşıma" },
] as const;

export const serviceLabel = (code: string) => SERVICES.find((s) => s.code === code)?.label ?? code;

/** Büyük fotoğraf (tıklayınca açılan) ve sayfadaki küçük önizleme. Logo sayfada 64-72 px kutuda (yüksek çözünürlüklü ekran için 192 px) */
export const SHOWCASE_PHOTO_SIDE = 1600;
export const SHOWCASE_THUMB_SIDE = 480;
export const SHOWCASE_LOGO_SIDE = 192;

export const DESCRIPTION_MAX = 3000;
