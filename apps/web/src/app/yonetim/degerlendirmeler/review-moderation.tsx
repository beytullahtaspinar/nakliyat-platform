"use client";

import { useState } from "react";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { Field, FormError, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { hideReview, showReview, type ReviewActionState } from "@/lib/actions/reviews";

/** Yorumu gerekçeyle gizleme ya da yeniden yayına alma */
export function ReviewModeration({ reviewId, isPublished }: { reviewId: string; isPublished: boolean }) {
  const [hiding, setHiding] = useState(false);
  const { state, pending, formProps } = useFormAction(hideReview.bind(null, reviewId), {} as ReviewActionState);

  if (!isPublished) {
    return (
      <ConfirmButton
        action={showReview.bind(null, reviewId)}
        label="Yeniden yayına al"
        confirmText="Yorum firma sayfasına ve puan ortalamasına geri dönecek."
        confirmLabel="Evet, yayına al"
        variant="quiet"
      />
    );
  }
  if (!hiding) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => setHiding(true)}>
        Gizle
      </Button>
    );
  }
  return (
    <form {...formProps} className="w-full space-y-3 rounded-lg bg-slate-50 p-3">
      <Field label="Gizleme gerekçesi" hint="Firma ve müşteri kendi panelinde görür. Ör. hakaret, kişisel bilgi, reklam, işle ilgisiz içerik.">
        <textarea name="reason" required minLength={5} maxLength={500} rows={2} className={inputClass} />
      </Field>
      <FormError message={state.error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "İşleniyor…" : "Yorumu gizle"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setHiding(false)} disabled={pending}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}
