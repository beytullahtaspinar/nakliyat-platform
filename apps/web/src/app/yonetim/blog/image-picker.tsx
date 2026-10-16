"use client";

import { useId, useRef, useState } from "react";
import { FormError } from "@/components/forms/fields";
import { attachBlogMedia, deleteBlogMedia, listBlogMedia, prepareBlogUpload } from "@/lib/actions/blog";
import type { BlogMediaItem } from "@/lib/blog/admin";
import { BLOG_IMAGE_SIDE, BLOG_THUMB_SIDE } from "@/lib/blog/rules";
import { compressImageSizes, MediaError } from "@/lib/media/compress";
import { putFile } from "@/lib/media/upload";

const smallButton =
  "inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 " +
  "hover:border-slate-400 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60";

/** Görseli tarayıcıda iki boyuta (1600 ve 800 px, WebP) küçültüp yükler ve kütüphaneye ekler */
export async function uploadBlogImage(file: File, alt?: string): Promise<BlogMediaItem> {
  const [main, thumb] = await compressImageSizes(file, [BLOG_IMAGE_SIDE, BLOG_THUMB_SIDE]);
  const info = (c: { blob: Blob; mimeType: string }) => ({ mimeType: c.mimeType, sizeBytes: c.blob.size });
  const ticket = await prepareBlogUpload(info(main), info(thumb));
  if (!ticket.ok) throw new MediaError(ticket.error);
  await putFile(ticket.data.file, main.blob, () => {});
  await putFile(ticket.data.thumb, thumb.blob, () => {});
  const saved = await attachBlogMedia({
    key: ticket.data.file.key,
    thumbKey: ticket.data.thumb.key,
    size: { width: main.width, height: main.height },
    thumbSize: { width: thumb.width, height: thumb.height },
    alt,
  });
  if (!saved.ok) throw new MediaError(saved.error);
  return saved.data;
}

/**
 * Görsel seçici: yeni görsel yükle ya da daha önce yüklenenlerden seç (kütüphane penceresi).
 * Kapak, içerik görseli ve yazar fotoğrafı için ortak.
 */
export function ImagePicker({
  uploadLabel,
  onSelect,
}: {
  uploadLabel: string;
  onSelect: (item: BlogMediaItem) => void;
}) {
  const inputId = useId();
  const titleId = useId();
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [library, setLibrary] = useState<{ items: BlogMediaItem[]; total: number; page: number } | null>(null);
  const [libraryError, setLibraryError] = useState<string>();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(undefined);
    setStatus("Yükleniyor…");
    try {
      onSelect(await uploadBlogImage(file));
    } catch (err) {
      setError(err instanceof MediaError ? err.message : "Görsel yüklenemedi, bağlantını kontrol edip tekrar dene.");
    } finally {
      setStatus(null);
      if (input.current) input.current.value = "";
    }
  };

  const loadLibrary = async (page: number) => {
    setLibraryError(undefined);
    const result = await listBlogMedia(page);
    if (result.ok) setLibrary({ ...result.data, page });
    else setLibraryError(result.error);
  };

  const openLibrary = () => {
    dialog.current?.showModal();
    void loadLibrary(1);
  };

  const remove = async (item: BlogMediaItem) => {
    if (!confirm("Görsel kütüphaneden silinsin mi?")) return;
    const result = await deleteBlogMedia(item.id);
    if (result.error) setLibraryError(result.error);
    else void loadLibrary(library?.page ?? 1);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className={`${smallButton} cursor-pointer focus-within:ring-2 focus-within:ring-brand-700/30`}>
          {status ?? uploadLabel}
          <input
            ref={input}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            disabled={status !== null}
            onChange={(e) => onFile(e.target.files?.[0])}
            className="sr-only"
          />
        </label>
        <button type="button" onClick={openLibrary} className={smallButton} aria-haspopup="dialog">
          Kütüphaneden seç
        </button>
      </div>
      {status && (
        <p role="status" className="sr-only">
          {status}
        </p>
      )}
      <FormError message={error} />

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[min(48rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-0 text-left shadow-xl backdrop:bg-slate-900/40"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            Görsel kütüphanesi
          </h2>
          <button type="button" onClick={() => dialog.current?.close()} className={smallButton}>
            Kapat
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          <FormError message={libraryError} />
          {!library && !libraryError && <p className="text-sm text-slate-600">Yükleniyor…</p>}
          {library && library.items.length === 0 && <p className="text-sm text-slate-600">Henüz görsel yüklenmedi.</p>}
          {library && library.items.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {library.items.map((item) => (
                <li key={item.id} className="overflow-hidden rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(item);
                      dialog.current?.close();
                    }}
                    className="block w-full hover:opacity-90"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.thumb.src} alt={item.alt || "Açıklamasız görsel"} loading="lazy" className="aspect-[16/10] w-full bg-slate-100 object-cover" />
                    <span className="sr-only">Seç</span>
                  </button>
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-slate-600">
                    <span>
                      {item.width}×{item.height}
                    </span>
                    <button type="button" onClick={() => remove(item)} className="font-medium text-red-700 hover:underline">
                      Sil
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {library && library.total > library.items.length && (
            <div className="mt-4 flex justify-between text-sm">
              <button type="button" className={smallButton} disabled={library.page <= 1} onClick={() => loadLibrary(library.page - 1)}>
                ← Önceki
              </button>
              <button
                type="button"
                className={smallButton}
                disabled={library.page * 24 >= library.total}
                onClick={() => loadLibrary(library.page + 1)}
              >
                Sonraki →
              </button>
            </div>
          )}
        </div>
      </dialog>
    </div>
  );
}
