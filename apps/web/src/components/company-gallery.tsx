"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicCompanyPhoto } from "@/lib/api";

/**
 * Firma fotoğrafları: ilk fotoğraf büyük, diğerleri yanında küçük önizleme (tembel yükleme).
 * Tıklayınca tam ekran görüntüleyici açılır: ok tuşları, kaydırma (telefon), sayaç ve açıklama.
 * JavaScript yoksa bağlantı büyük fotoğrafı doğrudan açar.
 */
export function CompanyGallery({ photos, companyName }: { photos: PublicCompanyPhoto[]; companyName: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const alt = (p: PublicCompanyPhoto, i: number) => p.caption ?? `${companyName} fotoğrafı ${i + 1}`;
  const count = photos.length;
  const featured = count >= 3;

  const show = (index: number) => {
    setOpen(index);
    dialog.current?.showModal();
  };
  const step = useCallback((delta: number) => setOpen((i) => (i === null ? i : (i + delta + count) % count)), [count]);

  useEffect(() => {
    if (open === null || count < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, count, step]);

  const current = open === null ? null : photos[open];

  return (
    <>
      <ul className={`mt-4 grid grid-cols-2 gap-2 sm:gap-3 ${featured ? "sm:grid-cols-4" : ""}`}>
        {photos.map((p, i) => {
          const big = (featured && i === 0) || count === 1;
          return (
            <li key={p.id} className={big ? "col-span-2 row-span-2" : undefined}>
              <figure className="group relative h-full">
                <a
                  href={p.url}
                  onClick={(e) => {
                    e.preventDefault();
                    show(i);
                  }}
                  className="block h-full overflow-hidden rounded-xl bg-zinc-100 ring-1 ring-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- tarayıcıda küçültülmüş WebP, kalıcı adres */}
                  <img
                    src={p.thumbUrl}
                    srcSet={big ? `${p.thumbUrl} 480w, ${p.url} 1600w` : undefined}
                    sizes={big ? "(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw" : undefined}
                    alt={alt(p, i)}
                    width={480}
                    height={360}
                    loading="lazy"
                    decoding="async"
                    className={`w-full object-cover transition duration-300 group-hover:scale-[1.03] ${big ? "aspect-[4/3] h-full" : "aspect-[4/3] h-auto"}`}
                  />
                </a>
                {p.caption && (
                  <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 truncate rounded-b-xl bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-6 text-sm font-medium text-white">
                    {p.caption}
                  </figcaption>
                )}
              </figure>
            </li>
          );
        })}
      </ul>
      <dialog
        ref={dialog}
        onClose={() => setOpen(null)}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        aria-label={current ? alt(current, open!) : "Fotoğraf"}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-zinc-950 p-0 text-white backdrop:bg-black"
      >
        {current && (
          <div
            className="flex h-full flex-col"
            onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
            onTouchEnd={(e) => {
              const start = touchX.current;
              const end = e.changedTouches[0]?.clientX;
              touchX.current = null;
              if (start === null || end === undefined || count < 2) return;
              if (Math.abs(end - start) > 50) step(end < start ? 1 : -1);
            }}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <p className="text-sm tabular-nums text-zinc-300" aria-live="polite">
                {open! + 1} / {count}
              </p>
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                className="ml-auto rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20"
              >
                Kapat
              </button>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
              {/* eslint-disable-next-line @next/next/no-img-element -- büyük fotoğraf yalnızca açılınca yüklenir */}
              <img
                key={current.id}
                src={current.url}
                alt={alt(current, open!)}
                width={current.width ?? undefined}
                height={current.height ?? undefined}
                className="max-h-full max-w-full rounded-lg object-contain"
              />
              {count > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    aria-label="Önceki fotoğraf"
                    className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-2xl hover:bg-black/70 sm:left-4"
                  >
                    <span aria-hidden>‹</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    aria-label="Sonraki fotoğraf"
                    className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-2xl hover:bg-black/70 sm:right-4"
                  >
                    <span aria-hidden>›</span>
                  </button>
                </>
              )}
            </div>
            <p className="min-h-12 px-4 py-3 text-center text-sm text-zinc-200">{current.caption ?? companyName}</p>
          </div>
        )}
      </dialog>
    </>
  );
}
