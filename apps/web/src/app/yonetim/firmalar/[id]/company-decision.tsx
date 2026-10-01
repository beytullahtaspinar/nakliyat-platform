"use client";

import { useState } from "react";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { Field, FormError, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { rejectCompany, verifyCompany, type AdminActionState } from "@/lib/actions/admin";
import type { VerificationStatus } from "@/lib/api";

export function CompanyDecision({ companyId, status }: { companyId: string; status: VerificationStatus }) {
  const [rejecting, setRejecting] = useState(false);
  const [notice, setNotice] = useState<string>();
  const { state, pending, formProps } = useFormAction(rejectCompany.bind(null, companyId), {} as AdminActionState);

  const verify = async () => {
    const result = await verifyCompany(companyId);
    if (result.notice) setNotice(result.notice);
    return result;
  };

  const message = notice ?? state.notice;
  return (
    <div className="space-y-3">
      {message && (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {message}
        </p>
      )}
      {status !== "VERIFIED" && (
        <ConfirmButton
          action={verify}
          label="Firmayı onayla"
          confirmText="K3 belgesini ve vergi numarasını kontrol ettin mi? Onaylanan firma hizmet bölgesindeki taleplere teklif verebilir."
          confirmLabel="Evet, onayla"
        />
      )}
      {rejecting && !state.notice ? (
        <form {...formProps} className="space-y-3 rounded-lg bg-zinc-50 p-3">
          <Field label="Ret gerekçesi" hint="Firma panelinde gösterilir; neyi düzeltmesi gerektiğini yazın.">
            <textarea name="reason" required minLength={5} maxLength={500} rows={3} className={inputClass} />
          </Field>
          <FormError message={state.error} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "İşleniyor…" : status === "VERIFIED" ? "Onayı kaldır" : "Reddet"}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setRejecting(false)} disabled={pending}>
              Vazgeç
            </Button>
          </div>
        </form>
      ) : (
        status !== "REJECTED" && (
          <Button type="button" size="sm" variant="secondary" onClick={() => setRejecting(true)}>
            {status === "VERIFIED" ? "Onayı kaldır" : "Reddet"}
          </Button>
        )
      )}
    </div>
  );
}
