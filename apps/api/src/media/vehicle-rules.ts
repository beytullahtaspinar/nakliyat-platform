import { VehicleFileKind } from '../generated/prisma/enums.js';
import { DOCUMENT_RULES } from './company-document-rules.js';

/**
 * Firma araçları: firma onayı için en az bir onaylı araç gerekir. Araçla birlikte ruhsat ve plakası okunur
 * şekilde önden, yandan, arkadan çekilmiş üç fotoğraf yüklenir; yönetici ruhsattaki plakayı fotoğraflardakiyle
 * karşılaştırır (otomatik plaka okuma yok). Web tarafındaki karşılığı: apps/web/src/lib/vehicles.ts
 */
export const VEHICLE_RULES = {
  maxVehicles: 20,
  /** Ruhsat belge gibi: PDF ya da fotoğraf, küçültülmez */
  registration: DOCUMENT_RULES,
  /** Fotoğraflar tarayıcıda küçültülür (en uzun kenar 2000 px); plaka okunabilsin diye talep fotoğraflarından büyük */
  photo: { maxBytes: 5 * 1024 * 1024, mimeTypes: ['image/webp', 'image/jpeg', 'image/png'] },
} as const;

export const VEHICLE_FILE_KINDS: VehicleFileKind[] = [
  VehicleFileKind.REGISTRATION,
  VehicleFileKind.FRONT,
  VehicleFileKind.SIDE,
  VehicleFileKind.REAR,
];

export const VEHICLE_FILE_LABELS: Record<VehicleFileKind, string> = {
  REGISTRATION: 'Araç ruhsatı',
  FRONT: 'Önden fotoğraf',
  SIDE: 'Yandan fotoğraf',
  REAR: 'Arkadan fotoğraf',
};

export const rulesFor = (kind: VehicleFileKind) =>
  kind === VehicleFileKind.REGISTRATION ? VEHICLE_RULES.registration : VEHICLE_RULES.photo;

/** Firma onayını engelleyen eksiğin yönetimde ve hata mesajında görünen adı */
export const VEHICLE_REQUIREMENT_LABEL = 'Onaylı araç (ruhsat ve plakalı fotoğraflar)';

/**
 * Türkiye plakası: il kodu (01-81), 1-3 harf, 2-5 rakam. Boşluk, tire ve nokta atılır, harfler büyütülür
 * ("34 abc 123" → "34ABC123"). Türkçe İ/ı plakada I olarak yazılır.
 */
export const PLATE_PATTERN = /^(0[1-9]|[1-7]\d|8[01])[A-Z]{1,3}\d{2,5}$/;

export const normalizePlate = (value: string) =>
  value
    .replace(/[İı]/g, 'I')
    .replace(/[\s.\-_]/g, '')
    .toUpperCase();

/** "34ABC123" → "34 ABC 123" */
export const formatPlate = (plate: string) => plate.replace(/^(\d{2})([A-Z]+)(\d+)$/, '$1 $2 $3');
