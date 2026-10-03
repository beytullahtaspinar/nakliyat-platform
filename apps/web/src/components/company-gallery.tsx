"use client";

import { useRef, useState } from "react";
import type { PublicCompanyPhoto } from "@/lib/api";

/**
 * Firma fotoğrafları: küçük önizlemeler (tembel yükleme), tıklayınca büyük hali pencerede açılır.
 * JavaScript yoksa bağlantı büyük fotoğrafı doğrudan açar.
 */
export function CompanyGallery({ photos, companyName }: { photos: PublicCompanyPhoto[]; companyName: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<number | null>(null);
  const alt = (p: PublicCompanyPhoto, i: number) => p.caption ?? `${companyName} fotoğrafı ${i + 1}`;
  const show = (index: number) => {
    setOpen(index);
    dialog.current?.showModal();
  };
  const current = open === null ? null : photos[open];

  return (
    <>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p, i) => (
          <li key={p.id}>
            <figure>
              <a
                href={p.url}
                onClick={(e) => {
                  e.preventDefault();
                  show(i);
                }}
                className="block overflow-hidden rounded-lg bg-zinc-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- tarayıcıda küçültülmüş WebP, kalıcı adres */}
                <img
                  src={p.thumbUrl}
                  alt={alt(p, i)}
                  width={480}
                  height={360}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/3] h-auto w-full object-cover"
                />
              </a>
              {p.caption && <figcaption className="mt-1 text-sm text-zinc-700">{p.caption}</figcaption>}
            </figure>
          </li>
        ))}
      </ul>
      <dialog
        ref={dialog}
        onClose={() => setOpen(null)}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        aria-label={current ? alt(current, open!) : "Fotoğraf"}
        className="m-auto max-h-[92vh] w-[min(64rem,94vw)] rounded-xl bg-white p-0 backdrop:bg-black/80"
      >
        {current && (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- büyük fotoğraf yalnızca açılınca yüklenir */}
            <img
              src={current.url}
              alt={alt(current, open!)}
              width={current.width ?? undefined}
              height={current.height ?? undefined}
              className="max-h-[80vh] w-full object-contain"
            />
            <div className="flex items-center gap-2 p-3">
              <p className="min-w-0 flex-1 text-sm text-zinc-700">
                {current.caption ?? `${open! + 1} / ${photos.length}`}
              </p>
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setOpen((open! - 1 + photos.length) % photos.length)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium"
                  >
                    Önceki
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen((open! + 1) % photos.length)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium"
                  >
                    Sonraki
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white"
              >
                Kapat
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
