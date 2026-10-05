"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { FormError } from "@/components/forms/fields";
import { attachShowcaseMedia, prepareShowcaseUpload } from "@/lib/actions/company-showcase";
import { compressImageSizes, MediaError } from "@/lib/media/compress";
import { putFile } from "@/lib/media/upload";
import { SHOWCASE_LOGO_SIDE, SHOWCASE_PHOTO_SIDE, SHOWCASE_THUMB_SIDE } from "@/lib/showcase";

const fileInputClass =
  "block w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 " +
  "file:text-sm file:font-semibold file:text-brand-800 hover:file:bg-brand-100";

/**
 * Logo ya da fotoğraf yükleme. Görsel tarayıcıda küçültülür (fotoğraf: büyük + küçük önizleme, logo: tek boyut),
 * WebP'ye çevrilir (konum bilgisi silinir) ve sırayla yüklenir. Fotoğrafta birden çok dosya seçilebilir.
 */
export function ImageUpload({ kind, label, remaining }: { kind: "LOGO" | "PHOTO"; label: string; remaining?: number }) {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const photo = kind === "PHOTO";

  const uploadOne = async (file: File) => {
    const sizes = photo ? [SHOWCASE_PHOTO_SIDE, SHOWCASE_THUMB_SIDE] : [SHOWCASE_LOGO_SIDE];
    const [main, thumb] = await compressImageSizes(file, sizes);
    const info = (c: { blob: Blob; mimeType: string }) => ({ mimeType: c.mimeType, sizeBytes: c.blob.size });
    const ticket = await prepareShowcaseUpload(kind, info(main), thumb && info(thumb));
    if (!ticket.ok) throw new MediaError(ticket.error);
    await putFile(ticket.data.file, main.blob, () => {});
    if (thumb && ticket.data.thumb) await putFile(ticket.data.thumb, thumb.blob, () => {});
    const saved = await attachShowcaseMedia({
      kind,
      key: ticket.data.file.key,
      thumbKey: ticket.data.thumb?.key,
      width: main.width,
      height: main.height,
    });
    if (!saved.ok) throw new MediaError(saved.error);
  };

  const onChange = async (files: FileList | null) => {
    const picked = [...(files ?? [])].filter((f) => f.type.startsWith("image/") || f.type === "");
    if (!picked.length) return;
    setError(undefined);
    const queue = photo && remaining !== undefined ? picked.slice(0, remaining) : picked.slice(0, 1);
    try {
      for (const [index, file] of queue.entries()) {
        setStatus(queue.length > 1 ? `Yükleniyor… ${index + 1}/${queue.length}` : "Yükleniyor…");
        await uploadOne(file);
      }
      if (picked.length > queue.length) setError(`En fazla ${remaining} fotoğraf daha eklenebilirdi; fazlası eklenmedi.`);
    } catch (err) {
      setError(err instanceof MediaError ? err.message : "Görsel yüklenemedi, bağlantını kontrol edip tekrar dene.");
    } finally {
      setStatus(null);
      if (input.current) input.current.value = "";
      router.refresh();
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-zinc-800">
        {label}
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple={photo}
        disabled={status !== null}
        onChange={(e) => onChange(e.target.files)}
        className={fileInputClass}
      />
      {status && (
        <p role="status" className="text-sm text-zinc-600">
          {status}
        </p>
      )}
      <FormError message={error} />
    </div>
  );
}
