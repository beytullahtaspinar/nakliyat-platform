"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { RequestMedia } from "@/lib/api";
import { formatDuration } from "./format";

/**
 * Talebe eklenmiş fotoğraf ve videolar, kaydırmalı slider olarak. Telefonda parmakla kaydırılır,
 * bilgisayarda oklar, klavye (sol/sağ ok) ve küçük resimlerle gezilir. Ek kütüphane yok: CSS scroll-snap.
 * Adresler kısa süreli imzalıdır; sayfa her açılışta yenisini alır. Fotoğrafa dokununca tam boyutu yeni sekmede açılır.
 */
export function MediaGallery({
  media,
  action,
}: {
  media: RequestMedia[];
  /** Görünen dosyanın altına eklenecek düğme (ör. müşteride "Sil") */
  action?: (item: RequestMedia) => ReactNode;
}) {
  const track = useRef<HTMLUListElement>(null);
  const [current, setCurrent] = useState(0);
  const count = media.length;
  const index = Math.min(current, Math.max(count - 1, 0));

  const goTo = useCallback((target: number) => {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(target, el.children.length - 1));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    setCurrent(next);
  }, []);

  // Parmakla kaydırınca görünen dosyayı izle
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setCurrent(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1))));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  if (!count) return null;
  const item = media[index]!;
  const photoNumbers = numberPhotos(media);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") goTo(index - 1);
    else if (event.key === "ArrowRight") goTo(index + 1);
    else return;
    event.preventDefault();
  };

  return (
    <div className="space-y-2">
      <div
        className="relative"
        role="region"
        aria-roledescription="slider"
        aria-label="Eşya fotoğrafları ve videoları"
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <ul
          ref={track}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-xl border border-zinc-200 bg-zinc-100 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {media.map((m, i) => (
            <li
              key={m.id}
              className="flex aspect-[4/3] w-full shrink-0 snap-center items-center justify-center"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
            >
              {m.type === "PHOTO" ? (
                <a href={m.url} target="_blank" rel="noopener" className="block h-full w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element -- imzalı, süreli depo adresi; zaten küçültülmüş */}
                  <img
                    src={m.url}
                    alt={`Eşya fotoğrafı ${photoNumbers.get(m.id)}`}
                    width={m.width ?? undefined}
                    height={m.height ?? undefined}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain"
                  />
                </a>
              ) : (
                <video
                  src={m.url}
                  controls
                  playsInline
                  preload="metadata"
                  width={m.width ?? undefined}
                  height={m.height ?? undefined}
                  className="h-full w-full bg-black object-contain"
                />
              )}
            </li>
          ))}
        </ul>

        {count > 1 && (
          <>
            <SlideButton label="Önceki" onClick={() => goTo(index - 1)} disabled={index === 0} side="left" />
            <SlideButton label="Sonraki" onClick={() => goTo(index + 1)} disabled={index === count - 1} side="right" />
            <p className="pointer-events-none absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
              {index + 1} / {count}
            </p>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-600">
          {item.type === "VIDEO" ? `Video${item.durationSec ? ` · ${formatDuration(item.durationSec)}` : ""}` : "Fotoğraf"}
        </p>
        {/* Dosya değişince düğmenin durumu (ör. açık silme onayı) sıfırlansın */}
        <Fragment key={item.id}>{action?.(item)}</Fragment>
      </div>

      {count > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {media.map((m, i) => (
            <li key={m.id} className="shrink-0">
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={`${i + 1}. dosyayı göster`}
                aria-current={i === index ? "true" : undefined}
                className={`block h-14 w-14 overflow-hidden rounded-lg border-2 bg-zinc-100 ${
                  i === index ? "border-brand-700" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                {m.type === "PHOTO" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- küçük resim, aynı imzalı adres (önbellekten gelir)
                  <img src={m.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-zinc-800 text-white" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SlideButton({
  label,
  onClick,
  disabled,
  side,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  side: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`absolute top-1/2 ${side === "left" ? "left-2" : "right-2"} flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-md hover:bg-white disabled:invisible`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <path d={side === "left" ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6"} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** Fotoğraflar kendi aralarında 1'den numaralanır (videolar araya girse de) */
function numberPhotos(media: RequestMedia[]) {
  const numbers = new Map<string, number>();
  for (const m of media) if (m.type === "PHOTO") numbers.set(m.id, numbers.size + 1);
  return numbers;
}
