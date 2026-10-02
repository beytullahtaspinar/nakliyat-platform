"use client";

import { useRef, useState, type DragEvent } from "react";
import { MAX_PHOTOS, MAX_VIDEO_SECONDS, MAX_VIDEOS } from "@/lib/media/rules";
import { formatBytes, formatDuration } from "./format";
import type { MediaPicker as Picker, PickedItem } from "./use-media-picker";

/**
 * Fotoğraf/video seçme alanı. Telefonda kamera veya galeri açılır; bilgisayarda sürükle-bırak da olur.
 * Dosya girişinin "name" özelliği yok: büyük orijinal dosyalar form ile sunucuya gönderilmez,
 * yalnızca küçültülmüş halleri ayrıca yüklenir.
 */
export function MediaPicker({ picker, disabled }: { picker: Picker; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { items } = picker;

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled && e.dataTransfer.files.length) picker.add(e.dataTransfer.files);
  };

  const ready = items.filter((i) => i.result);
  const original = ready.reduce((sum, i) => sum + i.originalBytes, 0);
  const compressed = ready.reduce((sum, i) => sum + i.result!.blob.size, 0);

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors disabled:opacity-60 ${
          dragging ? "border-brand-600 bg-brand-50" : "border-zinc-300 hover:border-brand-600 hover:bg-brand-50/50"
        }`}
      >
        <CameraIcon />
        <span className="font-medium text-brand-800">Fotoğraf veya video ekle</span>
        <span className="text-xs text-zinc-600">
          En fazla {MAX_PHOTOS} fotoğraf ve {MAX_VIDEOS} video ({MAX_VIDEO_SECONDS} sn). Dosyalar telefonunda küçültülür.
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        aria-label="Fotoğraf veya video seç"
        onChange={(e) => {
          if (e.target.files?.length) picker.add(e.target.files);
          e.target.value = "";
        }}
      />

      {picker.notice && (
        <p role="status" className="mt-2 text-sm text-amber-800">
          {picker.notice}
        </p>
      )}

      {items.length > 0 && (
        <>
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map((item) => (
              <PickedTile key={item.id} item={item} onRemove={disabled ? undefined : () => picker.remove(item.id)} />
            ))}
          </ul>
          {compressed > 0 && (
            <p className="mt-2 text-xs text-zinc-600">
              Yüklenecek: {formatBytes(compressed)}
              {original > compressed * 1.2 && ` (orijinali ${formatBytes(original)})`}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function PickedTile({ item, onRemove }: { item: PickedItem; onRemove?: () => void }) {
  const busy = item.status === "processing" || item.status === "uploading";
  return (
    <li className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
      {item.previewUrl &&
        (item.kind === "PHOTO" ? (
          // eslint-disable-next-line @next/next/no-img-element -- yerel önizleme (blob:), optimize edilecek bir şey yok
          <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <video src={item.previewUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        ))}
      {item.kind === "VIDEO" && item.result?.durationSec !== undefined && (
        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
          ▶ {formatDuration(item.result.durationSec)}
        </span>
      )}
      {busy && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/80 px-2 text-center text-xs text-zinc-800">
          <span>{item.status === "processing" ? (item.kind === "VIDEO" ? "Video küçültülüyor" : "Hazırlanıyor") : "Yükleniyor"}</span>
          {(item.kind === "VIDEO" || item.status === "uploading") && (
            <span className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
              <span className="block h-full bg-brand-600" style={{ width: `${Math.round(item.progress * 100)}%` }} />
            </span>
          )}
        </div>
      )}
      {item.status === "done" && (
        <span className="absolute bottom-1 right-1 rounded-full bg-brand-700 px-1.5 text-xs text-white">✓</span>
      )}
      {item.status === "error" && (
        <p className="absolute inset-0 flex items-center bg-red-50/95 p-2 text-xs text-red-800">{item.error}</p>
      )}
      {onRemove && item.status !== "uploading" && item.status !== "done" && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${item.name} dosyasını kaldır`}
          className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-sm text-white hover:bg-black"
        >
          ✕
        </button>
      )}
    </li>
  );
}

function CameraIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8 text-brand-700" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}
