"use client";

import { useState } from "react";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { Field, FormError, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { approveNameChange, rejectNameChange, type AdminActionState } from "@/lib/actions/admin";

/** Bekleyen görünen ad değişikliği için onay / gerekçeli ret (liste ve firma inceleme ekranı) */
export function NameChangeReview({ changeId, oldName, newName }: { changeId: string; oldName: string; newName: string }) {
  const [rejecting, setRejecting] = useState(false);
  const { state, pending, formProps } = useFormAction(rejectNameChange.bind(null, changeId), {} as AdminActionState);

  if (rejecting && !state.notice) {
    return (
      <form {...formProps} className="mt-2 w-full space-y-3 rounded-lg bg-zinc-50 p-3">
        <Field label="Ret gerekçesi" hint="Firma panelinde ad alanının altında gösterilir.">
          <textarea name="reason" required minLength={5} maxLength={500} rows={2} className={inputClass} />
        </Field>
        <FormError message={state.error} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "İşleniyor…" : "Adı reddet"}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setRejecting(false)} disabled={pending}>
            Vazgeç
          </Button>
        </div>
      </form>
    );
  }
  if (state.notice) return <p role="status" className="text-sm text-green-800">{state.notice}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmButton
        action={approveNameChange.bind(null, changeId)}
        label="Onayla"
        confirmText={`Firma “${oldName}” yerine “${newName}” adıyla görünecek. Yeni ad unvanla uyumlu ve başka bir firmayı taklit etmiyor mu?`}
        confirmLabel="Evet, onayla"
      />
      <Button type="button" size="sm" variant="secondary" onClick={() => setRejecting(true)}>
        Reddet
      </Button>
    </div>
  );
}
