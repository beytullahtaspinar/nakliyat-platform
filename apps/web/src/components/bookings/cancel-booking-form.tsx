"use client";

import { useState } from "react";
import { Field, FormError, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { cancelBooking, type ReviewActionState } from "@/lib/actions/reviews";

type Props = {
  bookingId: string;
  pagePath: string;
  /** Onay kutusunda gösterilen, iptalin karşı taraf için sonucunu anlatan cümle */
  consequence: string;
};

/** Anlaşılan işi gerekçeyle iptal etme. Geri alınamaz; önce gerekçe ve onay istenir. */
export function CancelBookingForm({ bookingId, pagePath, consequence }: Props) {
  const [asking, setAsking] = useState(false);
  const { state, pending, formProps } = useFormAction(cancelBooking.bind(null, bookingId, pagePath), {} as ReviewActionState);

  if (!asking) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => setAsking(true)}>
        İşi iptal et
      </Button>
    );
  }
  return (
    <form {...formProps} className="w-full space-y-3 rounded-lg bg-zinc-50 p-3 text-zinc-900">
      <p className="text-sm">{consequence} Bu işlem geri alınamaz.</p>
      <Field label="İptal nedeni" hint="Karşı taraf bildirimde bu metni görür.">
        <textarea name="reason" required minLength={5} maxLength={500} rows={2} className={inputClass} />
      </Field>
      <FormError message={state.error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "İşleniyor…" : "Evet, iptal et"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setAsking(false)} disabled={pending}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}
