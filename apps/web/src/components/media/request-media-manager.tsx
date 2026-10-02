"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { FormError } from "@/components/forms/fields";
import { removeMedia } from "@/lib/actions/media";
import type { RequestMedia } from "@/lib/api";
import { MediaGallery } from "./media-gallery";
import { MediaPicker } from "./media-picker";
import { useMediaPicker } from "./use-media-picker";

/** Müşterinin talep sayfası: eklenen dosyalar, silme ve sonradan fotoğraf/video ekleme */
export function RequestMediaManager({
  requestId,
  media,
  editable,
}: {
  requestId: string;
  media: RequestMedia[];
  editable: boolean;
}) {
  const router = useRouter();
  const picker = useMediaPicker({
    existingPhotos: media.filter((m) => m.type === "PHOTO").length,
    existingVideos: media.filter((m) => m.type === "VIDEO").length,
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    setUploading(true);
    setError(undefined);
    const result = await picker.upload(requestId);
    setUploading(false);
    if (result.error || result.failed) {
      setError(result.error ?? "Bazı dosyalar yüklenemedi. Tekrar denemek için yeniden ekle düğmesine bas.");
    } else {
      picker.clear();
    }
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {media.length === 0 && !editable && <p className="text-sm text-zinc-600">Fotoğraf veya video eklenmedi.</p>}
      <MediaGallery
        media={media}
        action={
          editable
            ? (m) => (
                <div className="mt-1">
                  <ConfirmButton
                    action={removeMedia.bind(null, requestId, m.id)}
                    label="Sil"
                    confirmText="Bu dosya silinecek."
                    confirmLabel="Sil"
                    variant="quiet"
                  />
                </div>
              )
            : undefined
        }
      />
      {editable && (
        <>
          <MediaPicker picker={picker} disabled={uploading} />
          <FormError message={error} />
          {(picker.readyCount > 0 || picker.processing || picker.items.some((i) => i.status === "error" && i.result)) && (
            <button
              type="button"
              onClick={submit}
              disabled={uploading || picker.processing}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-wait disabled:opacity-70"
            >
              {picker.processing ? "Dosyalar hazırlanıyor…" : uploading ? "Yükleniyor…" : "Talebe ekle"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
