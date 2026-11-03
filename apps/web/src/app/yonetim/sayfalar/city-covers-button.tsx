"use client";

import { useActionState } from "react";
import { FormError } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { importCityCovers, type LocalPageActionState } from "@/lib/actions/local-pages";

/**
 * Hazır, lisanslı il fotoğraflarını (Wikimedia Commons, fotoğrafçı ve lisans atfıyla) kapağı olmayan
 * il sayfalarına ekler. Elle seçilmiş kapaklara dokunmaz.
 */
export function CityCoversButton({ available }: { available: number }) {
  const [state, formAction, pending] = useActionState<LocalPageActionState, FormData>(() => importCityCovers(), {});
  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Ekleniyor…" : `İl görsellerini ekle (${available})`}
      </Button>
      {state.notice && (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {state.notice}
        </p>
      )}
      <FormError message={state.error} />
    </form>
  );
}
