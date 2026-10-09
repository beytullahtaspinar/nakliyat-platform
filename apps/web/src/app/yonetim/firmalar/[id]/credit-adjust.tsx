"use client";

import { FormError } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { adjustCredits, type AdminActionState } from "@/lib/actions/admin";

const input =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20";

/** Elle kredi ekleme/düşme: eksi miktar düşer; gerekçe firmanın hareket listesinde görünür */
export function CreditAdjust({ companyId }: { companyId: string }) {
  const { state, pending, formProps } = useFormAction(adjustCredits.bind(null, companyId), {} as AdminActionState);
  return (
    <form {...formProps} className="space-y-3">
      <label className="block">
        <span className="text-sm font-medium text-slate-800">Miktar (kredi)</span>
        <input name="amount" inputMode="numeric" required placeholder="Örnek: 500 ya da -100" className={input} />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-800">Gerekçe</span>
        <input name="note" required minLength={3} maxLength={500} placeholder="Örnek: Havale ile yükleme, 1 Ekim" className={input} />
      </label>
      <FormError message={state.error} />
      {state.notice && (
        <p role="status" className="text-sm text-green-800">
          {state.notice}
        </p>
      )}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "İşleniyor…" : "Krediyi işle"}
      </Button>
    </form>
  );
}
