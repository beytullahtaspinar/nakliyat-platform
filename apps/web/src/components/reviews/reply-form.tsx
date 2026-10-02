"use client";

import { useState } from "react";
import { Field, FormError, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { replyToReview, type ReviewActionState } from "@/lib/actions/reviews";
import { REPLY_MAX_LENGTH } from "@/lib/reviews";

/** Firmanın yoruma tek yanıtı. Yanıt değiştirilemediği için önce düğmeyle açılır. */
export function ReplyForm({ reviewId }: { reviewId: string }) {
  const [open, setOpen] = useState(false);
  const { state, pending, formProps } = useFormAction(replyToReview.bind(null, reviewId), {} as ReviewActionState);
  if (state.notice) {
    return (
      <p role="status" className="mt-3 text-sm font-medium text-green-800">
        {state.notice}
      </p>
    );
  }
  if (!open) {
    return (
      <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
        Yanıtla
      </Button>
    );
  }
  return (
    <form {...formProps} className="mt-3 space-y-3 rounded-lg bg-zinc-50 p-3">
      <Field
        label="Yanıtın"
        hint="Firma sayfasında yorumun altında herkese açık görünür ve sonradan değiştirilemez. Müşterinin adını, adresini yazma."
      >
        <textarea name="body" required minLength={2} maxLength={REPLY_MAX_LENGTH} rows={3} className={inputClass} />
      </Field>
      <FormError message={state.error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Gönderiliyor…" : "Yanıtı yayımla"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}
