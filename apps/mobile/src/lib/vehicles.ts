import type { CompanyVehicle, CompanyVehicleSummary, UploadTicket, VehicleFileKind } from '@nakliyat/api-client';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { api } from './api';
import { DOCUMENT_MAX_BYTES, mimeOf, type PickedFile } from './documents';
import type { Tone } from './requests';
import { putBytes, readFileBytes } from './upload';

/**
 * Sitedeki apps/web/src/lib/vehicles.ts ile aynı kurallar ve metinler. Firma onayı için en az bir onaylı araç gerekir:
 * ruhsat ve plakası okunacak şekilde önden, yandan, arkadan fotoğraf. Fotoğraflar en uzun kenarı 2000 px JPEG'e
 * küçültülür (plaka okunsun diye talep fotoğraflarından büyük); ruhsat PDF ise olduğu gibi gider.
 */
export const MAX_VEHICLES = 20;
const PHOTO_MAX_SIDE = 2000;
const REGISTRATION_PHOTO_SIDE = 2400;
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const VEHICLE_FILES: { kind: VehicleFileKind; label: string; hint: string }[] = [
  { kind: 'REGISTRATION', label: 'Araç ruhsatı', hint: 'Plakanın ve ruhsat sahibinin okunduğu sayfa. Fotoğraf ya da PDF.' },
  { kind: 'FRONT', label: 'Önden fotoğraf', hint: 'Ön plaka net okunmalı.' },
  { kind: 'SIDE', label: 'Yandan fotoğraf', hint: 'Aracın tamamı ve plakası görünmeli.' },
  { kind: 'REAR', label: 'Arkadan fotoğraf', hint: 'Arka plaka net okunmalı.' },
];

export const AUTHORIZATIONS: { value: CompanyVehicle['authorization']; label: string }[] = [
  { value: 'K3', label: 'K3 yetki belgesi' },
  { value: 'L1', label: 'L1 yetki belgesi' },
];

export const VEHICLE_STATES: Record<CompanyVehicle['status'], { label: string; tone: Tone }> = {
  VERIFIED: { label: 'Onaylandı', tone: 'success' },
  PENDING: { label: 'İnceleniyor', tone: 'accent' },
  REJECTED: { label: 'Reddedildi', tone: 'warning' },
};

export const PLATE_PATTERN = /^(0[1-9]|[1-7]\d|8[01])[A-Z]{1,3}\d{2,5}$/;

export const normalizePlate = (value: string) =>
  value
    .replace(/[İı]/g, 'I')
    .replace(/[\s.\-_]/g, '')
    .toUpperCase();

/** "34ABC123" → "34 ABC 123" */
export const formatPlate = (plate: string) => plate.replace(/^(\d{2})([A-Z]+)(\d+)$/, '$1 $2 $3');

/** Seçilen dosya: fotoğraflar küçültülmüş JPEG, ruhsat PDF olabilir */
export type VehicleFile = PickedFile & { width?: number; height?: number };

/** Fotoğrafı JPEG'e küçültür (EXIF yönü uygulanır, konum bilgisi atılır) */
export async function shrinkPhoto(file: VehicleFile, kind: VehicleFileKind): Promise<VehicleFile> {
  const max = kind === 'REGISTRATION' ? REGISTRATION_PHOTO_SIDE : PHOTO_MAX_SIDE;
  const context = ImageManipulator.manipulate(file.uri);
  if (file.width && file.height && Math.max(file.width, file.height) > max) {
    context.resize(file.width >= file.height ? { width: max } : { height: max });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return { uri: result.uri, name: file.name.replace(/\.[^.]+$/, '') + '.jpg', mimeType: 'image/jpeg', width: result.width, height: result.height };
}

async function uploadOne(kind: VehicleFileKind, file: VehicleFile) {
  const mimeType = mimeOf(file);
  const bytes = await readFileBytes(file.uri);
  const max = kind === 'REGISTRATION' ? DOCUMENT_MAX_BYTES : PHOTO_MAX_BYTES;
  if (bytes.byteLength > max) throw new Error(`Dosya çok büyük (en fazla ${max / 1024 / 1024} MB).`);
  const ticket = await api.request<UploadTicket>('/company/vehicles/uploads', {
    method: 'POST',
    body: { kind, mimeType, sizeBytes: bytes.byteLength },
  });
  if (!(await putBytes(ticket, bytes))) throw new Error('Dosya yüklenemedi, bağlantını kontrol edip tekrar dene.');
  return { key: ticket.key, fileName: file.name.slice(0, 200) };
}

/**
 * Dosyaları sırayla yükleyip aracı kaydeder (sitedeki akışın aynısı). vehicleId varsa onaylanmamış araç düzeltilir:
 * yalnızca değişen alanlar ve dosyalar gönderilir.
 */
export async function saveVehicle(
  vehicleId: string | null,
  fields: { plate?: string; type?: string; authorization?: string },
  files: Partial<Record<VehicleFileKind, VehicleFile>>,
  onProgress: (text: string) => void,
) {
  const queue = VEHICLE_FILES.filter((f) => files[f.kind]);
  const uploaded: Partial<Record<VehicleFileKind, { key: string; fileName: string }>> = {};
  for (const [index, spec] of queue.entries()) {
    onProgress(`Yükleniyor… ${index + 1}/${queue.length}`);
    uploaded[spec.kind] = await uploadOne(spec.kind, files[spec.kind]!);
  }
  onProgress('Kaydediliyor…');
  return api.request<CompanyVehicleSummary>(vehicleId ? `/company/vehicles/${encodeURIComponent(vehicleId)}` : '/company/vehicles', {
    method: vehicleId ? 'PATCH' : 'POST',
    body: { ...fields, ...(queue.length > 0 && { files: uploaded }) },
  });
}
