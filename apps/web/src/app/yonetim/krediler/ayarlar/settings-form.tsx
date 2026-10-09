"use client";

import { FormError } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { updateCreditSettings } from "@/lib/actions/admin";
import { CREDIT_SETTING_FIELDS, type CreditSettings } from "@/lib/credits";

const card = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const input =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20";

export function CreditSettingsForm({ settings, defaults }: { settings: CreditSettings; defaults: CreditSettings }) {
  const { state, pending, formProps } = useFormAction(updateCreditSettings, {});
  return (
    <form {...formProps} className="max-w-3xl space-y-5">
      <div className={card}>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="mt-1 h-5 w-5 accent-brand-700" />
          <span>
            <span className="block text-base font-semibold text-slate-900">Kredi sistemi açık</span>
            <span className="block text-sm text-slate-600">
              Açıkken firmalar teklif gönderirken kredi düşer, bakiyesi yetmeyen teklif veremez. Kapalıyken teklif vermek ücretsizdir.
            </span>
          </span>
        </label>
      </div>

      <div className={card}>
        <h2 className="text-base font-semibold text-slate-900">Değerler</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {CREDIT_SETTING_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-sm font-medium text-slate-800">
                {f.label} <span className="font-normal text-slate-500">({f.unit})</span>
              </span>
              <input name={f.key} inputMode={f.decimal ? "decimal" : "numeric"} required defaultValue={String(settings[f.key])} className={input} />
              <span className="mt-1 block text-xs text-slate-500">
                {f.hint}. Varsayılan: {defaults[f.key].toLocaleString("tr-TR")}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-600">
          Teklifi geri çeken firmaya iade yapılmaz. Müşteri talebi iptal ederse teklif veren firmalara kredi tamamen iade edilir.
        </p>
      </div>

      <div className="space-y-3">
        <FormError message={state.error} />
        {state.notice && (
          <p role="status" className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
            {state.notice}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </form>
  );
}
