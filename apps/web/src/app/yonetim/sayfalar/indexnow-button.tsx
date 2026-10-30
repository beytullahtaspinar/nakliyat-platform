"use client";

import { useActionState } from "react";
import { FormError } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { submitSitemapToIndexNow, type LocalPageActionState } from "@/lib/actions/local-pages";

/**
 * Site haritasındaki tüm sayfaları Bing/Yandex'e bildirir. Kaydedilen sayfa zaten kendiliğinden bildirilir;
 * bu düğme ilk kurulum ya da toplu değişiklik (ör. fiyat katsayıları) için.
 */
export function IndexNowButton() {
  const [state, formAction, pending] = useActionState<LocalPageActionState, FormData>(() => submitSitemapToIndexNow(), {});
  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Bildiriliyor…" : "Tüm sayfaları Bing'e bildir"}
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
