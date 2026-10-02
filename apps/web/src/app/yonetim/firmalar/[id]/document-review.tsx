"use client";

import { useState } from "react";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { Field, FormError, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { approveDocument, rejectDocument, type AdminActionState } from "@/lib/actions/admin";
import type { VerificationStatus } from "@/lib/api";

/** Tek belge için onay / gerekçeli ret */
export function DocumentReview({
  companyId,
  documentId,
  status,
}: {
  companyId: string;
  documentId: string;
  status: VerificationStatus;
}) {
  const [rejecting, setRejecting] = useState(false);
  const { state, pending, formProps } = useFormAction(
    rejectDocument.bind(null, companyId, documentId),
    {} as AdminActionState,
  );

  if (rejecting && !state.notice) {
    return (
      <form {...formProps} className="mt-2 w-full space-y-3 rounded-lg bg-zinc-50 p-3">
        <Field label="Ret gerekçesi" hint="Firma panelinde belgenin yanında gösterilir.">
          <textarea name="reason" required minLength={5} maxLength={500} rows={2} className={inputClass} />
        </Field>
        <FormError message={state.error} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "İşleniyor…" : "Belgeyi reddet"}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setRejecting(false)} disabled={pending}>
            Vazgeç
          </Button>
        </div>
      </form>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "VERIFIED" && (
        <ConfirmButton
          action={approveDocument.bind(null, companyId, documentId)}
          label="Onayla"
          confirmText="Belgeyi açıp resmî kayıtla karşılaştırdın mı?"
          confirmLabel="Evet, onayla"
        />
      )}
      {status !== "REJECTED" && (
        <Button type="button" size="sm" variant="secondary" onClick={() => setRejecting(true)}>
          Reddet
        </Button>
      )}
    </div>
  );
}
