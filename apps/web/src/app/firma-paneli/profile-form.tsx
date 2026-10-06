"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Field, FormError, Input, SubmitButton, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { saveCompanyProfile, type CompanyFormState } from "@/lib/actions/company";
import type { CompanyProfile } from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/format";
import { COMPANY } from "@/lib/legal";

type City = { code: string; name: string };

type Props = {
  cities: City[];
  profile?: CompanyProfile;
  /** Yönetim ekranı kendi kayıt eylemini verir; firma kimlik değişikliğinde yeniden doğrulamaya düşmez. */
  action?: (state: CompanyFormState, formData: FormData) => Promise<CompanyFormState>;
  /** Formun başına eklenen alanlar (yönetimden firma açarken yetkilinin hesabı) */
  children?: ReactNode;
};

export function ProfileForm({ cities, profile, action, children }: Props) {
  const { state, pending, formProps } = useFormAction(action ?? saveCompanyProfile.bind(null, !profile), {});
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
  // Firmanın kendi düzenlemesi (yönetim kendi eylemini verir; yeni firmada profil yok)
  const ownEdit = Boolean(profile && !action);
  const nameChange = ownEdit && profile?.verificationStatus === "VERIFIED" ? profile.nameChange : undefined;
  const support = (
    <a href={`mailto:${COMPANY.supportEmail}`} className="font-medium text-brand-700 hover:underline">
      {COMPANY.supportEmail}
    </a>
  );

  return (
    <form {...formProps} className="space-y-5">
      {children}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <Field label="Görünen ad" hint={nameChange ? nameHint(nameChange) : "Müşterilerin teklifinde göreceği ad."}>
            <Input
              name="displayName"
              defaultValue={nameChange?.pending?.newName ?? profile?.displayName}
              minLength={2}
              maxLength={80}
              required
              readOnly={nameChange?.remaining === 0}
            />
          </Field>
          {nameChange?.pending && profile && (
            <p role="status" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              “{nameChange.pending.newName}” adı onay bekliyor. Onaylanana kadar müşteriler “{profile.displayName}” adını görür.
              Eski ada dönersen talep geri çekilir.
            </p>
          )}
          {nameChange?.lastRejected && !nameChange.pending && (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
              “{nameChange.lastRejected.newName}” adı onaylanmadı
              {nameChange.lastRejected.reviewNote ? `. Gerekçe: ${nameChange.lastRejected.reviewNote}` : "."}
            </p>
          )}
        </div>
        {/* Unvan vergi levhasındaki resmi ad: firma kayıtta girer, sonra yalnızca yönetim değiştirir */}
        {ownEdit && profile ? (
          <ReadOnlyValue label="Ticari unvan" value={profile.legalName}>
            Vergi levhasındaki unvan; firma sayfanda görünür. Değiştirmek için {support} adresinden destek ile iletişime geç.
          </ReadOnlyValue>
        ) : (
          <Field label="Ticari unvan" hint="Vergi levhasındaki unvan.">
            <Input name="legalName" defaultValue={profile?.legalName} minLength={3} maxLength={200} required />
          </Field>
        )}
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
        {/* Telefon sahibin hesabındaki numara: yalnızca gösterilir, değişikliği yönetim yapar */}
        {!action && profile?.contactPhone && (
          <ReadOnlyValue label="Telefon" value={formatPhone(profile.contactPhone)}>
            Girişte ve müşteriyle iletişimde kullanılan numara. Değiştirmek için {support} adresinden destek ile iletişime geç.
          </ReadOnlyValue>
        )}
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

      {/* Firma tanıtım yazısını "Tanıtım sayfası" sekmesinde yazar; yönetim düzeltme için burada görür */}
      {action ? (
        <Field label="Tanıtım yazısı">
          <textarea
            name="description"
            rows={4}
            maxLength={3000}
            defaultValue={profile?.description ?? ""}
            placeholder="Kaç yıldır hizmet veriyorsunuz, araç filonuz, sigorta ve ekip bilgisi…"
            className={inputClass}
          />
        </Field>
      ) : (
        profile && (
          <p className="text-sm text-zinc-600">
            Tanıtım yazısı, logo ve fotoğraflar:{" "}
            <Link href="/firma-paneli/tanitim" className="font-semibold text-brand-700 hover:underline">
              Tanıtım sayfası
            </Link>
          </p>
        )
      )}

      {profile && !action && (
        <p className="text-xs text-zinc-500">
          Vergi numarası veya K3 belge numarası değişirse firman yeniden doğrulamaya alınır.
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

function nameHint({ limit, remaining, nextAvailableAt }: NonNullable<CompanyProfile["nameChange"]>) {
  if (remaining === 0) {
    return `Görünen adı yılda en fazla ${limit} kez değiştirebilirsin; hakkın doldu.${
      nextAvailableAt ? ` Sonraki değişiklik ${formatDate(nextAvailableAt)} tarihinden sonra.` : ""
    }`;
  }
  return `Yeni ad, yönetim onayından sonra yayına girer. Yılda en fazla ${limit} değişiklik; kalan hakkın: ${remaining}.`;
}

/** Firmanın değiştiremediği alan: yalnızca gösterilir */
function ReadOnlyValue({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
      <p className="mt-1 flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-base text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
        <span className="min-w-0 break-words">{value}</span>
        <span className="ml-auto shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          Değiştirilemez
        </span>
      </p>
      <span className="mt-1 block text-xs text-zinc-500">{children}</span>
    </div>
  );
}
