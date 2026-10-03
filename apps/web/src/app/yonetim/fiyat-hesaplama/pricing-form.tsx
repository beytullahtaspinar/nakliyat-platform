"use client";

import { useState } from "react";
import {
  PRICING_SETTING_SPECS,
  estimatePrice,
  normalizeSettings,
  type Calibration,
  type PriceInput,
  type PricingSettingKey,
  type PricingSettings,
} from "@nakliyat/pricing";
import { FormError } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { updatePricing } from "@/lib/actions/admin";
import { formatTry } from "@/lib/pricing";

const KEYS = Object.keys(PRICING_SETTING_SPECS) as PricingSettingKey[];

const toStrings = (s: PricingSettings) => Object.fromEntries(KEYS.map((k) => [k, String(s[k])])) as Record<PricingSettingKey, string>;

const base: PriceInput = {
  homeType: "TWO_PLUS_ONE",
  fromFloor: 2,
  fromHasElevator: true,
  toFloor: 2,
  toHasElevator: true,
  needsPacking: false,
  needsAssembly: false,
};

/** Formdaki değerlerle örnek taşınmaların fiyatı: kaydetmeden önce etkisi görülsün */
const examples = (exampleKm: number): { label: string; input: PriceInput }[] => [
  { label: "1+1, şehir içi, asansörlü", input: { ...base, homeType: "ONE_PLUS_ONE" } },
  { label: "2+1, şehir içi, asansörlü", input: base },
  { label: "3+1, şehir içi, asansörsüz 4. kattan, paketleme", input: { ...base, homeType: "THREE_PLUS_ONE", fromFloor: 4, fromHasElevator: false, needsPacking: true } },
  { label: `2+1, İstanbul – Ankara (${exampleKm} km)`, input: { ...base, distanceKm: exampleKm } },
  { label: `4+1, İstanbul – Ankara, paketleme ve montaj`, input: { ...base, homeType: "FOUR_PLUS_ONE", distanceKm: exampleKm, needsPacking: true, needsAssembly: true } },
];

export function PricingForm({
  settings,
  defaults,
  calibration,
  exampleKm,
}: {
  settings: PricingSettings;
  defaults: PricingSettings;
  calibration: Calibration;
  exampleKm: number;
}) {
  const { state, pending, formProps } = useFormAction(updatePricing, {});
  const [values, setValues] = useState(() => toStrings(settings));
  // Geçersiz alanlar önizlemede varsayılanla hesaplanır; kaydederken hata verilir
  const preview = normalizeSettings(Object.fromEntries(KEYS.map((k) => [k, Number(values[k].replace(",", "."))])));

  return (
    <form {...formProps} className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">Katsayılar</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {KEYS.map((key) => {
            const spec = PRICING_SETTING_SPECS[key];
            return (
              <label key={key} className="block">
                <span className="text-sm font-medium text-slate-800">
                  {spec.label} <span className="font-normal text-slate-500">({spec.unit})</span>
                </span>
                <input
                  name={key}
                  inputMode="decimal"
                  required
                  value={values[key]}
                  onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                />
                <span className="mt-1 block text-xs text-slate-500">
                  {spec.hint}. Varsayılan: {defaults[key].toLocaleString("tr-TR")}
                </span>
              </label>
            );
          })}
        </div>
        <div className="mt-5 space-y-3">
          <FormError message={state.error} />
          {state.notice && (
            <p role="status" className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
              {state.notice}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setValues(toStrings(defaults))}>
              Varsayılanları doldur
            </Button>
          </div>
        </div>
      </div>

      <div className="self-start rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">Önizleme</h2>
        <p className="mt-1 text-sm text-slate-600">Formdaki değerlerle, kaydetmeden önce. Ortalama eşya, 2. kattan 2. kata.</p>
        <ul className="mt-4 divide-y divide-slate-200 text-sm">
          {examples(exampleKm).map(({ label, input }) => {
            const e = estimatePrice(input, preview, calibration);
            return (
              <li key={label} className="py-2.5">
                <p className="text-slate-700">{label}</p>
                <p className="font-semibold text-slate-900">
                  {formatTry(e.minTry)} – {formatTry(e.maxTry)}
                  {e.source === "platform" && <span className="ml-2 text-xs font-medium text-brand-700">platform verisiyle</span>}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </form>
  );
}
