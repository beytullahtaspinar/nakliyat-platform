import { MediaType } from '../generated/prisma/enums.js';

/**
 * Talep fotoğraf/video kuralları. Dosyalar tarayıcıda küçültülür (fotoğraf: en uzun kenar 1600 px WebP,
 * video: 720p MP4 ya da WebM, 60 sn); buradaki sınırlar küçültülmüş dosyalar için güvenlik payıdır.
 * Web tarafındaki karşılığı: apps/web/src/lib/media/rules.ts
 */
export const MEDIA_RULES = {
  [MediaType.PHOTO]: { maxCount: 10, maxBytes: 3 * 1024 * 1024, mimeTypes: ['image/webp', 'image/jpeg'] },
  [MediaType.VIDEO]: { maxCount: 2, maxBytes: 30 * 1024 * 1024, mimeTypes: ['video/mp4', 'video/webm'] },
} as const;

export const MAX_VIDEO_SECONDS = 60;

/** Depoda tutulan tüm dosya türleri (talep medyası ve firma belgeleri) */
export const EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'video/mp4': 'mp4',
  // H.264 kodlayamayan tarayıcılar VP9/VP8 WebM üretir
  'video/webm': 'webm',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

export const MIME_BY_EXTENSION: Record<string, string> = Object.fromEntries(
  Object.entries(EXTENSIONS).map(([mime, ext]) => [ext, mime]),
);

/** Talebe eklenebilen türler (tarayıcıda küçültülmüş fotoğraf ve video) */
export const REQUEST_MIME_TYPES = ['image/webp', 'image/jpeg', 'video/mp4', 'video/webm'];

/**
 * talepler/<talepId>/<32 hex>.<uzantı> ya da firmalar/<firmaId>/<32 hex>.<uzantı>.
 * Yol geçişine (../) izin vermeyen tek biçim.
 */
export const STORAGE_KEY_PATTERN = /^(talepler|firmalar)\/[a-z0-9]{10,40}\/[a-f0-9]{32}\.(webp|jpg|png|pdf|mp4|webm)$/;

export const mediaTypeOf = (mimeType: string) =>
  mimeType.startsWith('video/') ? MediaType.VIDEO : MediaType.PHOTO;
