/**
 * Talep fotoğraf/video kuralları. API'deki karşılığı: apps/api/src/media/media-rules.ts
 * (API, küçültülmüş dosyalar için biraz daha geniş sınır uygular).
 */
export const MAX_PHOTOS = 10;
export const MAX_VIDEOS = 2;
export const MAX_VIDEO_SECONDS = 60;
/** Fotoğrafın en uzun kenarı; ekranda net, dosya ~150-400 KB */
export const PHOTO_MAX_SIDE = 1600;
/** Video: 720p (en uzun kenar 1280), ~1,2 Mbit/sn; 60 sn ≈ 9-10 MB */
export const VIDEO_MAX_SIDE = 1280;
export const VIDEO_BITRATE = 1_200_000;
export const AUDIO_BITRATE = 64_000;
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
/** Telefondan seçilen ham dosya için üst sınır (küçültmeden önce); tarayıcı belleğini korur */
export const MAX_SOURCE_BYTES = 1024 * 1024 * 1024;

export type MediaKind = "PHOTO" | "VIDEO";

export const kindOf = (file: File): MediaKind | null =>
  file.type.startsWith("image/") ? "PHOTO" : file.type.startsWith("video/") ? "VIDEO" : null;
