"use client";

import { FormError } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { saveCaption } from "@/lib/actions/company-showcase";

/** Fotoğraf açıklaması: sayfada fotoğrafın altında ve görselin alt metni olarak kullanılır */
export function CaptionForm({ mediaId, caption, max }: { mediaId: string; caption: string | null; max: number }) {
  const { state, pending, formProps } = useFormAction(saveCaption.bind(null, mediaId), {});
  return (
    <form {...formProps} className="space-y-1">
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`aciklama-${mediaId}`}>
          Fotoğraf açıklaması
        </label>
        <input
          id={`aciklama-${mediaId}`}
          name="caption"
          maxLength={max}
          defaultValue={caption ?? ""}
          placeholder="Açıklama (ör. Asansörlü aracımız)"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-70"
        >
          {pending ? "…" : "Kaydet"}
        </button>
      </div>
      {state.saved && !pending && (
        <p role="status" className="text-xs text-green-700">
          Kaydedildi.
        </p>
      )}
      <FormError message={state.error} />
    </form>
  );
}
