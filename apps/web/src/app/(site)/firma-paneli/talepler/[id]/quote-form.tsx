"use client";

import { Checkbox, Field, FormError, Input, SubmitButton, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { submitQuote } from "@/lib/actions/company";
import type { CompanyRequestView, OwnQuote } from "@/lib/api";
import { VEHICLE_LABELS } from "@/lib/request-options";

type Props = {
  request: CompanyRequestView;
  quote: OwnQuote | null;
  minDate: string;
  maxDate: string;
};

export function QuoteForm({ request, quote, minDate, maxDate }: Props) {
  const { state, pending, formProps } = useFormAction(submitQuote.bind(null, request.id), {});
  return (
    <form {...formProps} className="space-y-4">
      {quote && <input type="hidden" name="quoteId" value={quote.id} />}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Toplam fiyat (TL, KDV dahil)" className="col-span-2">
          <Input
            name="priceTry"
            type="number"
            inputMode="numeric"
            min={500}
            max={1000000}
            step={50}
            defaultValue={quote ? Math.round(Number(quote.priceTry)) : undefined}
            required
          />
        </Field>
        <Field label="Araç">
          <select name="vehicleType" required defaultValue={quote?.vehicleType ?? ""} className={inputClass}>
            <option value="" disabled>
              Seçin
            </option>
            {Object.entries(VEHICLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ekip (kişi)">
          <Input
            name="crewSize"
            type="number"
            min={1}
            max={20}
            defaultValue={quote?.crewSize ?? request.estimatedCrew ?? 2}
            required
          />
        </Field>
        <Field label="Geçerlilik (isteğe bağlı)" hint="Boş bırakırsan talep kapanana kadar geçerli." className="col-span-2">
          <Input
            name="validUntil"
            type="date"
            min={minDate}
            max={maxDate}
            defaultValue={quote ? quote.validUntil.slice(0, 10) : undefined}
          />
        </Field>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Fiyata dahil</p>
        <Checkbox name="includesPacking" label="Paketleme" defaultChecked={quote?.includesPacking ?? request.needsPacking} />
        <Checkbox
          name="includesAssembly"
          label="Mobilya söküm ve kurulumu"
          defaultChecked={quote?.includesAssembly ?? request.needsAssembly}
        />
        <Checkbox name="includesInsurance" label="Taşıma sigortası" defaultChecked={quote?.includesInsurance ?? false} />
      </div>
      <Field label="Müşteriye notun (isteğe bağlı)">
        <textarea
          name="message"
          rows={3}
          maxLength={2000}
          defaultValue={quote?.message ?? ""}
          placeholder="Örnek: Asansörlü taşıma ve koli malzemesi fiyata dahildir."
          className={inputClass}
        />
      </Field>
      <FormError message={state.error} />
      {state.notice && (
        <p role="status" className="text-sm font-medium text-green-700">
          {state.notice}
        </p>
      )}
      <SubmitButton pending={pending}>{quote ? "Teklifi güncelle" : "Teklifi gönder"}</SubmitButton>
    </form>
  );
}
