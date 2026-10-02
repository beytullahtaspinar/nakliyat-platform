"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Checkbox, Field, FormError, Input, SubmitButton, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { ConsentFields } from "@/components/legal/consent-fields";
import { MediaPicker } from "@/components/media/media-picker";
import { useMediaPicker } from "@/components/media/use-media-picker";
import { createRequest } from "@/lib/actions/requests";
import { FLOORS, HOME_TYPES } from "@/lib/request-options";

export type CityOption = { code: string; name: string; districts: { slug: string; name: string }[] };

type Props = {
  cities: CityOption[];
  userName: string | null;
  defaults: { fromCityCode?: string; fromDistrict?: string; toCityCode?: string };
  minDate: string;
  maxDate: string;
};

export function RequestForm({ cities, userName, defaults, minDate, maxDate }: Props) {
  const { state, pending, formProps } = useFormAction(createRequest, {});
  const picker = useMediaPicker();
  const router = useRouter();
  const [uploadState, setUploadState] = useState<"idle" | "uploading">("idle");
  const started = useRef<string>(undefined);

  // Talep oluştu: küçültülmüş dosyaları yükle, sonra hesabıma geç. Yükleme aksarsa talep yine de oluşmuştur;
  // müşteri talep sayfasından tekrar ekleyebilir.
  useEffect(() => {
    const id = state.createdId;
    if (!id || started.current === id) return;
    started.current = id;
    setUploadState("uploading");
    void picker.upload(id).then(({ failed, error }) => {
      const done =
        failed || error ? `/hesabim/talepler/${encodeURIComponent(id)}?medya=eksik` : `/hesabim?yeni=${encodeURIComponent(id)}`;
      router.push(state.needsVerification ? `/dogrulama?next=${encodeURIComponent(done)}` : done);
    });
  }, [state.createdId, state.needsVerification, picker, router]);

  const busy = pending || uploadState === "uploading";
  return (
    <form {...formProps} className="space-y-8">
      <input type="hidden" name="withMedia" value={picker.readyCount > 0 ? "1" : ""} />
      <Section title="Nereden taşınıyorsun?" step={1}>
        <AddressFields prefix="from" cities={cities} cityCode={defaults.fromCityCode} district={defaults.fromDistrict} />
      </Section>

      <Section title="Nereye taşınıyorsun?" step={2}>
        <AddressFields prefix="to" cities={cities} cityCode={defaults.toCityCode ?? defaults.fromCityCode} />
      </Section>

      <Section title="Evin ve tarih" step={3}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ev tipi">
            <select name="homeType" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Seçin
              </option>
              {HOME_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Taşınma tarihi">
            <Input name="moveDate" type="date" min={minDate} max={maxDate} required />
          </Field>
        </div>
        <div className="mt-4">
          <Checkbox name="isDateFlexible" label="Tarihim esnek, birkaç gün önce veya sonra da olabilir" />
        </div>
      </Section>

      <Section title="Ek hizmetler" step={4}>
        <div className="space-y-3">
          <Checkbox name="needsPacking" label="Eşyalarımı firma paketlesin" />
          <Checkbox name="needsAssembly" label="Mobilya söküm ve kurulumu (dolap, yatak vb.)" />
          <Checkbox name="needsStorage" label="Eşyalarımın bir süre depoda kalması gerekiyor" />
        </div>
        <div className="mt-4 grid gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-800">Eşyalarının fotoğrafı veya videosu (isteğe bağlı)</p>
            <p className="mb-2 mt-0.5 text-xs text-zinc-500">
              Firmalar eşyaları görünce daha doğru fiyat verir. Odaları gezerek kısa bir video çekmen yeterli.
              Adres veya kapı numarası görünmemesine dikkat et.
            </p>
            <MediaPicker picker={picker} disabled={busy} />
          </div>
          <Field label="Özel eşyalar (isteğe bağlı)" hint="Virgülle ayırın. Örnek: piyano, antika vitrin, kasa">
            <Input name="specialItems" maxLength={1000} />
          </Field>
          <Field label="Firmalara notun (isteğe bağlı)">
            <textarea
              name="notes"
              rows={3}
              maxLength={2000}
              placeholder="Örnek: sokak dar, kamyon girmiyor; bina girişinde 5 basamak var."
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      {userName ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Talep <strong>{userName}</strong> hesabıyla oluşturulacak.
        </p>
      ) : (
        <Section title="Teklifleri nereden takip edeceksin?" step={5}>
          <AccountFields />
        </Section>
      )}

      <div className="space-y-3">
        <FormError message={state.error} />
        {uploadState === "uploading" ? (
          <p role="status" className="rounded-lg bg-brand-50 px-3 py-2 text-center text-sm text-brand-900">
            Talebin oluşturuldu, fotoğraf ve videolar yükleniyor…
          </p>
        ) : picker.processing ? (
          <p role="status" className="text-center text-sm text-zinc-600">
            Fotoğraf ve videolar küçültülüyor, birazdan gönderebilirsin.
          </p>
        ) : null}
        <SubmitButton pending={busy || picker.processing}>Ücretsiz teklif iste</SubmitButton>
        <p className="text-center text-xs text-zinc-500">
          Açık adresin ve telefonun yalnızca teklifini kabul ettiğin firmayla paylaşılır.
        </p>
      </div>
    </form>
  );
}

function Section({ title, step, children }: { title: string; step: number; children: ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <legend className="flex items-center gap-2 px-1 text-lg font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-700 text-sm text-white">
          {step}
        </span>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function AddressFields({
  prefix,
  cities,
  cityCode: initialCity = "",
  district: initialDistrict = "",
}: {
  prefix: "from" | "to";
  cities: CityOption[];
  cityCode?: string;
  district?: string;
}) {
  const [cityCode, setCityCode] = useState(initialCity);
  const [district, setDistrict] = useState(initialDistrict);
  const city = cities.find((c) => c.code === cityCode);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="İl">
        <select
          name={`${prefix}CityCode`}
          required
          value={cityCode}
          onChange={(e) => {
            setCityCode(e.target.value);
            setDistrict("");
          }}
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
      <Field label="İlçe">
        <select
          name={`${prefix}District`}
          required
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          disabled={!city}
          className={inputClass}
        >
          <option value="" disabled>
            {city ? "İlçe seçin" : "Önce il seçin"}
          </option>
          {city?.districts.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.name}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Açık adres"
        hint="Mahalle, cadde/sokak, bina ve daire no."
        className="sm:col-span-2"
      >
        <Input name={`${prefix}Address`} autoComplete={prefix === "from" ? "street-address" : "off"} minLength={5} maxLength={300} required />
      </Field>
      <Field label="Kat">
        <select name={`${prefix}Floor`} required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Kat seçin
          </option>
          {FLOORS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex items-end pb-2">
        <Checkbox name={`${prefix}HasElevator`} label="Binada asansör var" />
      </div>
    </div>
  );
}

function AccountFields() {
  const [account, setAccount] = useState<"register" | "login">("register");
  const tab = (active: boolean) =>
    `flex-1 rounded-md px-3 py-2 text-sm font-medium ${
      active ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400"
    }`;

  return (
    <div className="space-y-4">
      <input type="hidden" name="account" value={account} />
      <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
        <button type="button" className={tab(account === "register")} onClick={() => setAccount("register")}>
          İlk kez geliyorum
        </button>
        <button type="button" className={tab(account === "login")} onClick={() => setAccount("login")}>
          Hesabım var
        </button>
      </div>
      {account === "register" && (
        <Field label="Ad soyad">
          <Input name="fullName" autoComplete="name" minLength={3} maxLength={100} required />
        </Field>
      )}
      <Field label="Cep telefonu" hint={account === "register" ? "Tekliflerini görmek için giriş yaparken bu numarayı kullanacaksın." : undefined}>
        <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="05XX XXX XX XX" required />
      </Field>
      <Field label="Şifre" hint={account === "register" ? "En az 8 karakter." : undefined}>
        <Input
          name="password"
          type="password"
          autoComplete={account === "register" ? "new-password" : "current-password"}
          minLength={account === "register" ? 8 : undefined}
          maxLength={72}
          required
        />
      </Field>
      {account === "register" && (
        <>
          <Field label="E-posta" hint="Talebini yayınlamadan önce bu adrese bir doğrulama kodu göndereceğiz.">
            <Input name="email" type="email" autoComplete="email" maxLength={191} required />
          </Field>
          <ConsentFields />
        </>
      )}
    </div>
  );
}
