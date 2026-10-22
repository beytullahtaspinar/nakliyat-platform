"use client";

import { useState } from "react";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { Field, FormError, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { approveVehicle, rejectVehicle, type AdminActionState } from "@/lib/actions/admin";
import type { VerificationStatus } from "@/lib/api";

/** Sık kullanılan ret gerekçeleri; seçince metin kutusuna yazılır, düzenlenebilir */
const REASONS = [
  "Ruhsattaki plaka fotoğraflardaki plakayla aynı değil.",
  "Fotoğraflarda plaka okunmuyor; plaka net görünecek şekilde yeniden çekin.",
  "Ruhsat okunmuyor ya da eksik; plakanın göründüğü sayfayı yükleyin.",
  "Araç yetki belgesine (K3/L1) kayıtlı görünmüyor.",
];

/** Tek araç için onay / gerekçeli ret */
export function VehicleReview({
  companyId,
  vehicleId,
  status,
}: {
  companyId: string;
  vehicleId: string;
  status: VerificationStatus;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const { state, pending, formProps } = useFormAction(
    rejectVehicle.bind(null, companyId, vehicleId),
    {} as AdminActionState,
  );

  if (rejecting && !state.notice) {
    return (
      <form {...formProps} className="mt-2 w-full space-y-3 rounded-lg bg-zinc-50 p-3">
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-left text-xs text-zinc-800 hover:bg-zinc-100"
            >
              {r}
            </button>
          ))}
        </div>
        <Field label="Ret gerekçesi" hint="Firma panelinde aracın yanında gösterilir.">
          <textarea
            name="reason"
            required
            minLength={5}
            maxLength={500}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={inputClass}
          />
        </Field>
        <FormError message={state.error} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "İşleniyor…" : "Aracı reddet"}
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
          action={approveVehicle.bind(null, companyId, vehicleId)}
          label="Onayla"
          confirmText="Ruhsattaki plaka önden, yandan ve arkadan fotoğraflardaki plakayla aynı mı?"
          confirmLabel="Evet, aynı; onayla"
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
