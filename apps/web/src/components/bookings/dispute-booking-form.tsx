"use client";

import { useState } from "react";
import { Field, FormError, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { disputeBooking, type ReviewActionState } from "@/lib/actions/reviews";

type Props = {
  bookingId: string;
  pagePath: string;
  /** Onay kutusunda karşı tarafın adı: "Firma" ya da müşterinin adı */
  counterpart: string;
};

/** "Taşınma yapılmadı" itirazı: iş kendiliğinden tamamlanmaz, yönetim inceler. Önce açıklama ve onay istenir. */
export function DisputeBookingForm({ bookingId, pagePath, counterpart }: Props) {
  const [asking, setAsking] = useState(false);
  const { state, pending, formProps } = useFormAction(disputeBooking.bind(null, bookingId, pagePath), {} as ReviewActionState);

  if (!asking) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => setAsking(true)}>
        Taşınma yapılmadı
      </Button>
    );
  }
  return (
    <form {...formProps} className="w-full space-y-3 rounded-lg bg-zinc-50 p-3 text-zinc-900">
      <p className="text-sm">
        İş tamamlandı sayılmayacak; yönetim iki tarafla görüşüp karar verecek. {counterpart} itirazını bildirimle öğrenir.
      </p>
      <Field label="Ne oldu?" hint="Karşı taraf ve yönetim bu metni görür.">
        <textarea name="reason" required minLength={5} maxLength={500} rows={2} className={inputClass} />
      </Field>
      <FormError message={state.error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Gönderiliyor…" : "İtirazı gönder"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setAsking(false)} disabled={pending}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}
