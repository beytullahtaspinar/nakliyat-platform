"use client";

import { useState } from "react";
import { Field, FormError, Input, SubmitButton, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { saveCompanyProfile } from "@/lib/actions/company";
import type { CompanyProfile } from "@/lib/api";

type City = { code: string; name: string };

export function ProfileForm({ cities, profile }: { cities: City[]; profile?: CompanyProfile }) {
  const { state, pending, formProps } = useFormAction(saveCompanyProfile.bind(null, !profile), {});
  const [cityCode, setCityCode] = useState(profile?.cityCode ?? "");
  const [service, setService] = useState<Set<string>>(new Set(profile?.serviceCityCodes ?? []));
  const toggle = (code: string) =>
    setService((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  const allSelected = service.size === cities.length;

  return (
    <form {...formProps} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Görünen ad" hint="Müşterilerin teklifinde göreceği ad.">
          <Input name="displayName" defaultValue={profile?.displayName} minLength={2} maxLength={80} required />
        </Field>
        <Field label="Ticari unvan" hint="Vergi levhasındaki unvan.">
          <Input name="legalName" defaultValue={profile?.legalName} minLength={3} maxLength={200} required />
        </Field>
        <Field label="Vergi numarası" hint="10 hane; şahıs şirketiyse 11 haneli TC kimlik no.">
          <Input
            name="taxNumber"
            defaultValue={profile?.taxNumber}
            inputMode="numeric"
            pattern="\d{10,11}"
            required
          />
        </Field>
        <Field label="K3 yetki belgesi no" hint="Evden eve taşımacılık için gerekli.">
          <Input name="k3LicenseNumber" defaultValue={profile?.k3LicenseNumber ?? ""} maxLength={50} placeholder="K3.34.123456" />
        </Field>
        <Field label="Merkez il">
          <select
            name="cityCode"
            required
            value={cityCode}
            onChange={(e) => setCityCode(e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              İl seçin
            </option>
            {cities.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Hizmet verdiğin iller</legend>
        <p className="mt-1 text-xs text-zinc-500">
          Bu illerden çıkan veya bu illere giden talepleri görürsün. Merkez il her zaman dahildir.
        </p>
        <button
          type="button"
          onClick={() => setService(allSelected ? new Set() : new Set(cities.map((c) => c.code)))}
          className="mt-2 text-sm font-medium text-brand-700 hover:underline"
        >
          {allSelected ? "Seçimi temizle" : "Tüm Türkiye"}
        </button>
        <div className="mt-2 grid max-h-60 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-3 text-sm sm:grid-cols-3 dark:border-zinc-800">
          {cities.map((c) => {
            const isCenter = c.code === cityCode;
            return (
              <label key={c.code} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="serviceCityCodes"
                  value={c.code}
                  checked={isCenter || service.has(c.code)}
                  disabled={isCenter}
                  onChange={() => toggle(c.code)}
                  className="h-4 w-4 accent-brand-700"
                />
                {c.name}
              </label>
            );
          })}
        </div>
      </fieldset>

      <Field label="Firmanı tanıt (isteğe bağlı)">
        <textarea
          name="description"
          rows={4}
          maxLength={3000}
          defaultValue={profile?.description ?? ""}
          placeholder="Kaç yıldır hizmet veriyorsunuz, araç filonuz, sigorta ve ekip bilgisi…"
          className={inputClass}
        />
      </Field>

      {profile && (
        <p className="text-xs text-zinc-500">
          Unvan, vergi numarası veya K3 belge numarası değişirse firman yeniden doğrulamaya alınır.
        </p>
      )}
      <FormError message={state.error} />
      {state.saved && (
        <p role="status" className="text-sm font-medium text-green-700">
          Kaydedildi.
        </p>
      )}
      <SubmitButton pending={pending}>{profile ? "Kaydet" : "Firmayı kaydet"}</SubmitButton>
    </form>
  );
}
