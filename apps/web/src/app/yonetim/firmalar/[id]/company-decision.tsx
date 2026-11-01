"use client";

import { useState } from "react";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { Field, FormError, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { rejectCompany, verifyCompany, verifyCompanyWithOverride, type AdminActionState } from "@/lib/actions/admin";
import type { VerificationStatus } from "@/lib/api";

export function CompanyDecision({
  companyId,
  status,
  missing,
}: {
  companyId: string;
  status: VerificationStatus;
  /** Onaylanmamış zorunlu belgeler ve araç; boş değilse onay için gerekçe istenir */
  missing: string[];
}) {
  const [open, setOpen] = useState<"reject" | "override">();
  const [notice, setNotice] = useState<string>();
  const reject = useFormAction(rejectCompany.bind(null, companyId), {} as AdminActionState);
  const override = useFormAction(verifyCompanyWithOverride.bind(null, companyId), {} as AdminActionState);

  const verify = async () => {
    const result = await verifyCompany(companyId);
    if (result.notice) setNotice(result.notice);
    return result;
  };

  const message = notice ?? reject.state.notice ?? override.state.notice;
  const done = Boolean(message);
  return (
    <div className="space-y-3">
      {message && (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {message}
        </p>
      )}
      {status !== "VERIFIED" && missing.length > 0 && !done && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p>Onay için önce şunlar onaylanmalı: {missing.join(", ")}.</p>
          <p className="mt-1">Gerekirse gerekçe yazarak yine de onaylayabilirsin.</p>
        </div>
      )}
      {status !== "VERIFIED" && missing.length === 0 && !done && (
        <ConfirmButton
          action={verify}
          label="Firmayı onayla"
          confirmText="Belgeler ve araç onaylı. Vergi numarası ve unvanı da kontrol ettin mi? Onaylanan firma hizmet bölgesindeki taleplere teklif verebilir."
          confirmLabel="Evet, onayla"
        />
      )}

      {open === "override" && !done && (
        <form {...override.formProps} className="space-y-3 rounded-lg border border-amber-200 bg-white p-3">
          <Field
            label="Eksiklere rağmen onay gerekçesi"
            hint="Firmaya gösterilmez; karar geçmişine eksiklerle birlikte yazılır. Firma onaylanınca teklif verebilir."
          >
            <textarea name="reason" required minLength={5} maxLength={500} rows={3} className={inputClass} />
          </Field>
          <FormError message={override.state.error ?? override.invalid} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={override.pending}>
              {override.pending ? "İşleniyor…" : "Yine de onayla"}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(undefined)} disabled={override.pending}>
              Vazgeç
            </Button>
          </div>
        </form>
      )}

      {open === "reject" && !done && (
        <form {...reject.formProps} className="space-y-3 rounded-lg bg-zinc-50 p-3">
          <Field label="Ret gerekçesi" hint="Firma panelinde gösterilir; neyi düzeltmesi gerektiğini yazın.">
            <textarea name="reason" required minLength={5} maxLength={500} rows={3} className={inputClass} />
          </Field>
          <FormError message={reject.state.error ?? reject.invalid} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={reject.pending}>
              {reject.pending ? "İşleniyor…" : status === "VERIFIED" ? "Onayı kaldır" : "Reddet"}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(undefined)} disabled={reject.pending}>
              Vazgeç
            </Button>
          </div>
        </form>
      )}

      {!open && !done && (
        <div className="flex flex-wrap gap-2">
          {status !== "VERIFIED" && missing.length > 0 && (
            <Button type="button" size="sm" onClick={() => setOpen("override")}>
              Eksiklere rağmen onayla
            </Button>
          )}
          {status !== "REJECTED" && (
            <Button type="button" size="sm" variant="secondary" onClick={() => setOpen("reject")}>
              {status === "VERIFIED" ? "Onayı kaldır" : "Reddet"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
