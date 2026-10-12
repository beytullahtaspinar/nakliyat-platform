import type { RequestMedia, UploadTicket } from '@nakliyat/api-client';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { api } from './api';

// Sitedeki apps/web/src/lib/media/rules.ts ile aynı sınırlar. Uygulamadan yalnızca fotoğraf eklenir:
// telefon videoları (iPhone'da HEVC/.mov) API'nin kabul ettiği MP4/WebM'e burada çevrilemiyor.
export const MAX_PHOTOS = 10;
/** Fotoğrafın en uzun kenarı; ekranda net, dosya ~150-400 KB */
const PHOTO_MAX_SIDE = 1600;
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

export type PreparedPhoto = { uri: string; width: number; height: number };

/** En uzun kenarı 1600 px JPEG'e küçültür (EXIF yönü uygulanır, konum bilgisi atılır) */
async function shrink(asset: ImagePicker.ImagePickerAsset): Promise<PreparedPhoto> {
  const context = ImageManipulator.manipulate(asset.uri);
  const longest = Math.max(asset.width, asset.height);
  if (longest > PHOTO_MAX_SIDE) {
    context.resize(asset.width >= asset.height ? { width: PHOTO_MAX_SIDE } : { height: PHOTO_MAX_SIDE });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.75 });
  return { uri: result.uri, width: result.width, height: result.height };
}

/**
 * Galeriden ya da kameradan fotoğraf alır ve küçültür. İzin verilmezse anlaşılır bir hata fırlatır.
 * limit: daha kaç fotoğraf eklenebilir.
 */
export async function pickPhotos(source: 'library' | 'camera', limit: number): Promise<PreparedPhoto[]> {
  if (limit <= 0) return [];
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Fotoğraf çekmek için kamera izni gerekiyor. Telefon ayarlarından açabilirsin.');
  } else {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('Fotoğraf seçmek için fotoğraflarına erişim izni gerekiyor. Telefon ayarlarından açabilirsin.');
  }
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          selectionLimit: limit,
          orderedSelection: true,
          quality: 1,
        });
  if (result.canceled) return [];
  const photos: PreparedPhoto[] = [];
  // Sırayla: telefonun belleği yorulmasın
  for (const asset of result.assets.slice(0, limit)) photos.push(await shrink(asset));
  return photos;
}

/**
 * Küçültülmüş fotoğrafları talebe yükler: önce yükleme adresleri alınır, dosyalar doğrudan depoya gider,
 * sonra talebe bağlanır (sitedeki akışın aynısı). Yüklenemeyenlerin sayısı döner.
 */
export async function uploadPhotos(requestId: string, photos: PreparedPhoto[]): Promise<{ added: RequestMedia[]; failed: number }> {
  if (photos.length === 0) return { added: [], failed: 0 };
  const blobs = await Promise.all(photos.map(async (p) => (await fetch(p.uri)).blob()));
  const usable = photos.map((p, i) => ({ photo: p, blob: blobs[i] })).filter((x) => x.blob.size <= MAX_PHOTO_BYTES);
  const base = `/requests/${encodeURIComponent(requestId)}/media`;
  const { uploads } = await api.request<{ uploads: UploadTicket[] }>(`${base}/uploads`, {
    method: 'POST',
    body: { files: usable.map((x) => ({ mimeType: 'image/jpeg', sizeBytes: x.blob.size })) },
  });
  const items: { key: string; width: number; height: number }[] = [];
  for (const [i, ticket] of uploads.entries()) {
    const { photo, blob } = usable[i];
    const res = await fetch(ticket.url, { method: ticket.method, headers: ticket.headers, body: blob }).catch(() => null);
    if (res?.ok) items.push({ key: ticket.key, width: photo.width, height: photo.height });
  }
  const added = items.length ? await api.request<RequestMedia[]>(base, { method: 'POST', body: { items } }) : [];
  return { added, failed: photos.length - added.length };
}

export const removePhoto = (requestId: string, mediaId: string) =>
  api.request(`/requests/${encodeURIComponent(requestId)}/media/${encodeURIComponent(mediaId)}`, { method: 'DELETE' });
