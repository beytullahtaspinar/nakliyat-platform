import type { ReactNode } from "react";
import type { RequestMedia } from "@/lib/api";
import { formatDuration } from "./format";

/**
 * Talebe eklenmiş fotoğraf ve videolar. Adresler kısa süreli imzalıdır; sayfa her açılışta yenisini alır.
 * Fotoğrafa dokununca tam boyutu yeni sekmede açılır.
 */
export function MediaGallery({
  media,
  action,
}: {
  media: RequestMedia[];
  /** Her dosyanın altına eklenecek düğme (ör. müşteride "Sil") */
  action?: (item: RequestMedia) => ReactNode;
}) {
  if (!media.length) return null;
  const photos = media.filter((m) => m.type === "PHOTO");
  const videos = media.filter((m) => m.type === "VIDEO");
  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((m, index) => (
            <li key={m.id}>
              <a href={m.url} target="_blank" rel="noopener" className="block overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
                {/* eslint-disable-next-line @next/next/no-img-element -- imzalı, süreli depo adresi; zaten küçültülmüş */}
                <img
                  src={m.url}
                  alt={`Eşya fotoğrafı ${index + 1}`}
                  width={m.width ?? undefined}
                  height={m.height ?? undefined}
                  loading="lazy"
                  decoding="async"
                  className="aspect-square h-auto w-full object-cover"
                />
              </a>
              {action?.(m)}
            </li>
          ))}
        </ul>
      )}
      {videos.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {videos.map((m) => (
            <li key={m.id}>
              <video
                src={m.url}
                controls
                playsInline
                preload="metadata"
                width={m.width ?? undefined}
                height={m.height ?? undefined}
                className="aspect-video h-auto w-full rounded-lg bg-black"
              />
              <p className="mt-1 text-xs text-zinc-600">
                Video{m.durationSec ? ` · ${formatDuration(m.durationSec)}` : ""}
              </p>
              {action?.(m)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
