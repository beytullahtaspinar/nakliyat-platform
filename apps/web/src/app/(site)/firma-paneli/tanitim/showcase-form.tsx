"use client";

import { useState } from "react";
import { Field, FormError, Input, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { saveShowcase } from "@/lib/actions/company-showcase";
import type { CompanyShowcase } from "@/lib/api";
import { DESCRIPTION_MAX, SERVICES } from "@/lib/showcase";

/** Tanıtım yazısı, hizmetler, kuruluş yılı, araç ve ekip sayısı */
export function ShowcaseForm({ showcase }: { showcase: CompanyShowcase }) {
  const { state, pending, formProps } = useFormAction(saveShowcase, {});
  const [length, setLength] = useState(showcase.description?.trim().length ?? 0);
  const { minDescription } = showcase.indexing;
  const year = new Date().getFullYear();

  return (
    <form {...formProps} className="space-y-5">
      <Field
        label="Tanıtım yazısı"
        hint={`Kaç yıldır çalıştığınız, araçlarınız, ekibiniz, sigorta, hangi işlerde deneyimli olduğunuz… Telefon, e-posta ve web adresi yazılamaz; müşteri teklifini kabul edince iletişim bilgilerin ona iletilir. ${length}/${DESCRIPTION_MAX} karakter${length < minDescription ? `, Google için en az ${minDescription}` : ""}.`}
      >
        <textarea
          name="description"
          rows={8}
          maxLength={DESCRIPTION_MAX}
          defaultValue={showcase.description ?? ""}
          onChange={(e) => setLength(e.target.value.trim().length)}
          placeholder="Örnek: 2008'den beri İzmir ve çevresinde evden eve nakliyat yapıyoruz. Asansörlü araçlarımız ve deneyimli ekibimizle…"
          className={inputClass}
        />
      </Field>

      <fieldset>
        <legend className="text-sm font-medium text-zinc-800">Verdiğin hizmetler</legend>
        <div className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {SERVICES.map((s) => (
            <label key={s.code} className="flex items-center gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                name="services"
                value={s.code}
                defaultChecked={showcase.services.includes(s.code)}
                className="h-4 w-4 accent-brand-700"
              />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Kuruluş yılı">
          <Input name="foundedYear" type="number" inputMode="numeric" min={1900} max={year} defaultValue={showcase.foundedYear ?? ""} />
        </Field>
        <Field label="Araç sayısı">
          <Input name="fleetSize" type="number" inputMode="numeric" min={1} max={999} defaultValue={showcase.fleetSize ?? ""} />
        </Field>
        <Field label="Ekip (kişi)">
          <Input name="staffSize" type="number" inputMode="numeric" min={1} max={9999} defaultValue={showcase.staffSize ?? ""} />
        </Field>
      </div>

      <FormError message={state.error} />
      {state.saved && !pending && (
        <p role="status" className="text-sm font-medium text-green-700">
          Kaydedildi, sayfanda yayında.
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Kaydediliyor…" : "Kaydet"}
      </Button>
    </form>
  );
}
