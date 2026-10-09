"use client";

import { useState } from "react";
import { Field, FormError, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { startCardPayment, type CardPaymentState } from "@/lib/actions/credits";
import { CARD_PRESETS, creditsForAmount, formatCredits, parseTryAmount } from "@/lib/credits";

/** Kartla kredi yükleme: tutar seçilir, iyzico'nun güvenli ödeme sayfasına gidilir */
export function CardForm({ minTry, maxTry, creditValueTry }: { minTry: number; maxTry: number; creditValueTry: number }) {
  const { state, pending, invalid, formProps } = useFormAction(startCardPayment, {} as CardPaymentState);
  const presets = CARD_PRESETS.filter((p) => p >= minTry && p <= maxTry);
  const [amount, setAmount] = useState(String(presets[1] ?? presets[0] ?? minTry));
  const value = parseTryAmount(amount);
  const credits = Number.isFinite(value) ? creditsForAmount(value, creditValueTry) : 0;
  const outOfRange = Number.isFinite(value) && (value < minTry || value > maxTry);

  return (
    <form {...formProps} className="space-y-4">
      <fieldset>
        <legend className="text-sm font-medium text-zinc-800">Hızlı seçim</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {presets.map((p) => {
            const selected = value === p;
            return (
              <button
                key={p}
                type="button"
                aria-pressed={selected}
                onClick={() => setAmount(String(p))}
                className={`rounded-lg border px-3.5 py-2 text-sm font-semibold tabular-nums ${
                  selected ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 bg-white text-slate-800 hover:border-slate-400"
                }`}
              >
                {p.toLocaleString("tr-TR")} TL
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tutar (TL, KDV dahil)" hint={`${minTry.toLocaleString("tr-TR")} – ${maxTry.toLocaleString("tr-TR")} TL`}>
          <input name="amountTry" inputMode="decimal" autoComplete="off" required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
        </Field>
        <p aria-live="polite" className="self-end rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
          {outOfRange ? (
            `Tutar ${minTry.toLocaleString("tr-TR")} ile ${maxTry.toLocaleString("tr-TR")} TL arasında olmalı.`
          ) : credits > 0 ? (
            <>
              Ödeme sonrası hemen <strong className="text-slate-900">{formatCredits(credits)}</strong> yüklenir.
            </>
          ) : (
            `1 kredi ${creditValueTry.toLocaleString("tr-TR")} TL.`
          )}
        </p>
      </div>
      <FormError message={state.error ?? invalid} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || outOfRange || credits < 1}>
          {pending ? "Ödeme sayfası açılıyor…" : "Kartla öde"}
        </Button>
        <p className="text-xs text-slate-600">
          iyzico&apos;nun güvenli ödeme sayfasında 3D Secure ile ödersin; kart bilgin bize gelmez.
        </p>
      </div>
    </form>
  );
}
