import type { CompanyVehicle, VehicleFileKind } from "@/lib/api";
import { DOCUMENT_ACCEPT, DOCUMENT_MAX_BYTES, DOCUMENT_MIME_TYPES } from "@/lib/company-documents";

/**
 * Firma araçları. API'deki karşılığı: apps/api/src/media/vehicle-rules.ts
 * Ruhsat belge gibi yüklenir (PDF ya da fotoğraf, küçültülmez); araç fotoğrafları tarayıcıda en uzun kenarı
 * 2000 px olacak şekilde küçültülür, plaka okunabilsin diye talep fotoğraflarından büyük tutulur.
 */
export const MAX_VEHICLES = 20;
export const VEHICLE_PHOTO_SIDE = 2000;
export const VEHICLE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const REGISTRATION_MAX_BYTES = DOCUMENT_MAX_BYTES;
export const REGISTRATION_MIME_TYPES = DOCUMENT_MIME_TYPES;
export const REGISTRATION_ACCEPT = DOCUMENT_ACCEPT;
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

export const VEHICLE_FILES: { kind: VehicleFileKind; label: string; hint: string }[] = [
  {
    kind: "REGISTRATION",
    label: "Araç ruhsatı",
    hint: "Plakanın ve ruhsat sahibinin okunduğu sayfa. Fotoğraf ya da PDF, en fazla 10 MB.",
  },
  { kind: "FRONT", label: "Önden fotoğraf", hint: "Ön plaka net okunmalı." },
  { kind: "SIDE", label: "Yandan fotoğraf", hint: "Aracın tamamı ve plakası görünmeli." },
  { kind: "REAR", label: "Arkadan fotoğraf", hint: "Arka plaka net okunmalı." },
];

export const VEHICLE_FILE_LABELS = Object.fromEntries(VEHICLE_FILES.map((f) => [f.kind, f.label])) as Record<
  VehicleFileKind,
  string
>;

export const AUTHORIZATIONS: { value: CompanyVehicle["authorization"]; label: string; hint: string }[] = [
  { value: "K3", label: "K3 yetki belgesi", hint: "Eşya taşımacılığı (evden eve nakliyat)" },
  { value: "L1", label: "L1 yetki belgesi", hint: "Lojistik" },
];

export const VEHICLE_STATES: Record<
  CompanyVehicle["status"],
  { label: string; tone: "success" | "warning" | "danger" }
> = {
  VERIFIED: { label: "Onaylandı", tone: "success" },
  PENDING: { label: "İnceleniyor", tone: "warning" },
  REJECTED: { label: "Reddedildi", tone: "danger" },
};

/** Firma onayını engelleyen eksik (yönetim) */
export const VEHICLE_REQUIREMENT = "Onaylı araç (ruhsat ve plakalı fotoğraflar)";

/** Türkiye plakası: il kodu (01-81), 1-3 harf, 2-5 rakam */
export const PLATE_PATTERN = /^(0[1-9]|[1-7]\d|8[01])[A-Z]{1,3}\d{2,5}$/;

export const normalizePlate = (value: string) =>
  value
    .replace(/[İı]/g, "I")
    .replace(/[\s.\-_]/g, "")
    .toUpperCase();

/** "34ABC123" → "34 ABC 123" */
export const formatPlate = (plate: string) => plate.replace(/^(\d{2})([A-Z]+)(\d+)$/, "$1 $2 $3");
