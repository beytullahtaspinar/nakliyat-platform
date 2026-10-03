"use client";

import { useState } from "react";
import { Field, FormError, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { setCompanyMediaHidden, type AdminActionState } from "@/lib/actions/admin";

/** Tanıtım görselini gerekçeyle gizle ya da geri yayınla */
export function MediaModeration({ companyId, mediaId, hidden }: { companyId: string; mediaId: string; hidden: boolean }) {
  const [asking, setAsking] = useState(false);
  const { state, pending, formProps } = useFormAction(
    setCompanyMediaHidden.bind(null, companyId, mediaId, !hidden),
    {} as AdminActionState,
  );

  if (!hidden && asking && !state.notice) {
    return (
      <form {...formProps} className="space-y-2 rounded-lg bg-zinc-50 p-2">
        <Field label="Gizleme gerekçesi" hint="Firma panelinde görselin altında gösterilir.">
          <textarea name="reason" required minLength={3} maxLength={300} rows={2} className={inputClass} />
        </Field>
        <FormError message={state.error} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "İşleniyor…" : "Gizle"}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setAsking(false)} disabled={pending}>
            Vazgeç
          </Button>
        </div>
      </form>
    );
  }
  if (hidden) {
    return (
      <form {...formProps}>
        <FormError message={state.error} />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "İşleniyor…" : "Yeniden yayınla"}
        </Button>
      </form>
    );
  }
  return (
    <Button type="button" size="sm" variant="secondary" onClick={() => setAsking(true)}>
      Sayfadan kaldır
    </Button>
  );
}
