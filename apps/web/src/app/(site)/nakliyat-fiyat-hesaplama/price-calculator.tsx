"use client";

import Link from "next/link";
import { useId, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { estimatePrice, type Calibration, type HomeType, type LoadLevel, type PricingSettings } from "@nakliyat/pricing";
import { inputClass } from "@/components/forms/fields";
import { buttonClass } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { DEFAULT_INPUT, LOAD_OPTIONS, formatTry, pairIndex, requestPrefillQuery, type CalculatorInput } from "@/lib/pricing";
import { FLOORS, HOME_TYPES } from "@/lib/request-options";

export type CalculatorCity = { code: string; name: string };

type Props = {
  cities: CalculatorCity[];
  /** İl merkezleri arası km, üst üçgen dizi (lib/pricing.ts pairIndex) */
  distances: number[];
  settings: PricingSettings;
  calibration: Calibration;
};

/** Adres sayfa açıkken değişmez: dinlemeye gerek yok */
const noSubscription = () => () => {};

/** Adresteki ?nereden=34&nereye=06&ev=... ile gelen değerler (il sayfalarından ve paylaşılan bağlantılardan) */
function fromQuery(search: string, cities: CalculatorCity[]): Partial<CalculatorInput> {
  const q = new URLSearchParams(search);
  const city = (key: string) => {
    const code = q.get(key);
    return code && cities.some((c) => c.code === code) ? code : undefined;
  };
  const floor = (key: string) => {
    const value = Number(q.get(key) ?? "x");
    return FLOORS.some((f) => f.value === value) ? value : undefined;
  };
  const flag = (key: string) => (q.has(key) ? q.get(key) === "1" : undefined);
  const from = city("nereden");
  const result: Partial<CalculatorInput> = {
    from,
    to: city("nereye") ?? from,
    homeType: HOME_TYPES.find((t) => t.value === q.get("ev"))?.value,
    load: LOAD_OPTIONS.find((o) => o.value === q.get("esya"))?.value,
    fromFloor: floor("kat"),
    toFloor: floor("varisKat"),
    fromHasElevator: flag("asansor"),
    toHasElevator: flag("varisAsansor"),
    needsPacking: flag("paket"),
    needsAssembly: flag("montaj"),
  };
  return Object.fromEntries(Object.entries(result).filter(([, v]) => v !== undefined));
}

export function PriceCalculator({ cities, distances, settings, calibration }: Props) {
  // Sayfa önbellekten (statik) sunulur; adresteki ön bilgiler (il sayfalarından gelen bağlantılar) tarayıcıda
  // okunur. Sunucuda ve ilk çizimde adres boş sayılır, ardından React adresle yeniden çizer.
  const search = useSyncExternalStore(noSubscription, () => window.location.search, () => "");
  const prefill = useMemo(() => fromQuery(search, cities), [search, cities]);
  const [changes, setChanges] = useState<Partial<CalculatorInput>>({});
  const input: CalculatorInput = { ...DEFAULT_INPUT, ...prefill, ...changes };
  const set = <K extends keyof CalculatorInput>(key: K, value: CalculatorInput[K]) =>
    setChanges((prev) => ({ ...prev, [key]: value }));

  const distanceKm = useMemo(() => {
    if (input.from === input.to) return undefined;
    const a = cities.findIndex((c) => c.code === input.from);
    const b = cities.findIndex((c) => c.code === input.to);
    if (a < 0 || b < 0) return undefined;
    return distances[pairIndex(Math.min(a, b), Math.max(a, b), cities.length)];
  }, [input.from, input.to, cities, distances]);

  const estimate = estimatePrice({ ...input, distanceKm }, settings, calibration);
  const cityName = (code: string) => cities.find((c) => c.code === code)?.name ?? "";
  const route =
    distanceKm === undefined ? `${cityName(input.from)} şehir içi` : `${cityName(input.from)} → ${cityName(input.to)}, yaklaşık ${distanceKm.toLocaleString("tr-TR")} km`;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
      <form
        className="space-y-6 rounded-[var(--radius-card)] border border-zinc-200 bg-white p-5 shadow-[var(--shadow-card)] sm:p-6"
        onSubmit={(e) => e.preventDefault()}
        aria-label="Fiyat hesaplama bilgileri"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CitySelect label="Nereden" value={input.from} cities={cities} onChange={(v) => set("from", v)} />
          <CitySelect label="Nereye" value={input.to} cities={cities} onChange={(v) => set("to", v)} />
        </div>

        <ChoiceGroup legend="Ev tipi">
          {HOME_TYPES.map((t) => (
            <Choice
              key={t.value}
              name="homeType"
              checked={input.homeType === t.value}
              onChange={() => set("homeType", t.value as HomeType)}
            >
              {t.label}
            </Choice>
          ))}
        </ChoiceGroup>

        <ChoiceGroup legend="Eşya miktarı">
          {LOAD_OPTIONS.map((o) => (
            <Choice key={o.value} name="load" checked={input.load === o.value} onChange={() => set("load", o.value as LoadLevel)} hint={o.hint}>
              {o.label}
            </Choice>
          ))}
        </ChoiceGroup>

        <div className="grid gap-4 sm:grid-cols-2">
          <FloorField
            label="Çıkış katı"
            floor={input.fromFloor}
            elevator={input.fromHasElevator}
            onFloor={(v) => set("fromFloor", v)}
            onElevator={(v) => set("fromHasElevator", v)}
          />
          <FloorField
            label="Varış katı"
            floor={input.toFloor}
            elevator={input.toHasElevator}
            onFloor={(v) => set("toFloor", v)}
            onElevator={(v) => set("toHasElevator", v)}
          />
        </div>

        <fieldset className="space-y-2.5">
          <legend className="text-sm font-medium text-zinc-800">Ek hizmetler</legend>
          <Toggle checked={input.needsPacking} onChange={(v) => set("needsPacking", v)}>
            Eşyaları firma paketlesin
          </Toggle>
          <Toggle checked={input.needsAssembly} onChange={(v) => set("needsAssembly", v)}>
            Mobilya söküm ve kurulumu
          </Toggle>
        </fieldset>
      </form>

      <section
        aria-labelledby="tahmin-baslik"
        className="self-start rounded-[var(--radius-card)] bg-brand-900 p-6 text-white shadow-[var(--shadow-card)] lg:sticky lg:top-24"
      >
        <h2 id="tahmin-baslik" className="text-sm font-semibold uppercase tracking-wider text-accent-300">
          Tahmini fiyat aralığı
        </h2>
        <div aria-live="polite" aria-atomic="true">
          <p className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-4xl">
            {formatTry(estimate.minTry)} <span className="text-brand-200">–</span> {formatTry(estimate.maxTry)}
          </p>
          <p className="mt-2 text-brand-100">{route}</p>
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
          <Stat label="Eşya hacmi" value={`~${estimate.volumeM3} m³`} />
          <Stat label="Ekip" value={`${estimate.crew} kişi`} />
          <Stat label="Araç" value={`${estimate.vehicles}`} />
        </dl>
        <p className="mt-5 text-sm text-brand-100">
          {estimate.source === "platform"
            ? `Platformda yapılan ${estimate.samples} gerçek anlaşmanın fiyatlarına göre ayarlandı.`
            : "Ortalama işçilik, araç ve mesafe maliyetleriyle hesaplandı. Platformda anlaşma sayısı arttıkça gerçek fiyatlarla ayarlanır."}{" "}
          Bu bir teklif değil, tahmindir: kesin fiyatı firmalar bilgilerini görerek verir.
        </p>
        <Link
          href={`/talep-olustur?${requestPrefillQuery(input)}`}
          className={buttonClass({ variant: "inverse", size: "lg", className: "mt-6 w-full" })}
        >
          Bu bilgilerle ücretsiz teklif al <ArrowRightIcon className="h-5 w-5" />
        </Link>
        <p className="mt-3 text-center text-xs text-brand-200">Doğrulanmış firmalardan gerçek fiyat al, karşılaştır.</p>
      </section>
    </div>
  );
}

function CitySelect({
  label,
  value,
  cities,
  onChange,
}: {
  label: string;
  value: string;
  cities: CalculatorCity[];
  onChange: (code: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {cities.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChoiceGroup({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-zinc-800">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

/** Radyo düğmesi, seçilebilir kutucuk görünümünde (klavyeyle ok tuşlarıyla gezilir) */
function Choice({
  name,
  checked,
  onChange,
  hint,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label
      className={`cursor-pointer rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-700/40 ${
        checked ? "border-brand-700 bg-brand-50 text-brand-900" : "border-zinc-300 text-zinc-700 hover:border-zinc-400"
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
      {hint && <span className="block text-xs font-normal text-zinc-600">{hint}</span>}
    </label>
  );
}

function FloorField({
  label,
  floor,
  elevator,
  onFloor,
  onElevator,
}: {
  label: string;
  floor: number;
  elevator: boolean;
  onFloor: (floor: number) => void;
  onElevator: (elevator: boolean) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-zinc-800">
        {label}
      </label>
      <select id={id} value={floor} onChange={(e) => onFloor(Number(e.target.value))} className={inputClass}>
        {FLOORS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      <div className="mt-2">
        <Toggle checked={elevator} onChange={onElevator}>
          Binada asansör var
        </Toggle>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-800">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-brand-700" />
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-2 py-3">
      <dt className="text-xs text-brand-200">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
