import type { Metadata } from "next";
import { getAdminContext } from "@/lib/admin";
import { apiFetch, type AdminStats } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { FilterTabs, PageHeader, query } from "../admin-bits";
import { Bar, DailyColumns, formatDay, formatNumber, formatPercent } from "./charts";

export const metadata: Metadata = { title: { absolute: "İstatistikler | Yönetim" } };

const PERIODS = [7, 30, 90] as const;

/** Önceki döneme göre değişim: "+3 (%25)"; önceki dönem 0 ise yalnızca fark */
function Change({ current, previous, days }: { current: number; previous: number; days: number }) {
  const diff = current - previous;
  const pct = previous > 0 ? ` (${diff > 0 ? "+" : ""}${formatPercent(diff / previous)})` : "";
  const text = diff === 0 ? "Değişmedi" : `${diff > 0 ? "▲ +" : "▼ "}${formatNumber(diff)}${pct}`;
  return (
    <p className="mt-1 text-xs text-slate-600">
      <span className={diff > 0 ? "font-semibold text-brand-700" : diff < 0 ? "font-semibold text-slate-700" : undefined}>{text}</span>
      <span className="sr-only">, önceki {days} günde {formatNumber(previous)}</span>
      <span aria-hidden> · önceki {formatNumber(previous)}</span>
    </p>
  );
}

const card = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm";

export default async function AdminStatsPage({ searchParams }: PageProps<"/yonetim/istatistikler">) {
  const { token } = await getAdminContext();
  const params = await searchParams;
  const days = PERIODS.find((p) => String(p) === params.donem) ?? 30;
  const stats = await apiFetch<AdminStats>(`/admin/stats?days=${days}`, { token });
  const { current, previous } = stats.totals;

  const tiles = [
    { label: "Yeni talep", key: "requests" },
    { label: "Verilen teklif", key: "quotes" },
    { label: "Anlaşılan iş", key: "bookings" },
    { label: "Tamamlanan iş", key: "completed" },
    { label: "Yeni müşteri", key: "customers" },
    { label: "Firma başvurusu", key: "companies" },
    { label: "Onaylanan firma", key: "verifiedCompanies" },
  ] as const;

  const f = stats.funnel;
  const funnel = [
    { label: "Açılan talep", value: f.requests, rate: f.requests > 0 ? 1 : null, note: "" },
    { label: "Teklif alan", value: f.quoted, rate: f.quotedRate, note: "talebin" },
    { label: "Firma seçilen", value: f.booked, rate: f.bookedRate, note: "talebin" },
    { label: "Tamamlanan", value: f.completed, rate: f.completedRate, note: "seçilen işin" },
  ];

  const maxCity = Math.max(0, ...stats.cities.map((c) => c.requests));
  const maxRating = Math.max(0, ...stats.ratings.distribution.map((r) => r.count));
  const range = `${formatDay(stats.daily[0]!.day)} – ${formatDay(stats.daily.at(-1)!.day)}`;

  return (
    <>
      <PageHeader
        title="İstatistikler"
        description={`Son ${days} gün (${range}, Türkiye saatiyle). Değişimler önceki ${days} güne göre.`}
      />
      <FilterTabs
        label="Dönem"
        current={String(days)}
        options={PERIODS.map((p) => ({ value: String(p), label: `Son ${p} gün`, href: `/yonetim/istatistikler${query({ donem: p === 30 ? undefined : p })}` }))}
      />

      <h2 className="sr-only">Dönem toplamları</h2>
      <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {tiles.map((t) => (
          <li key={t.key} className={card}>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{formatNumber(current[t.key])}</p>
            <p className="mt-0.5 text-sm text-slate-600">{t.label}</p>
            <Change current={current[t.key]} previous={previous[t.key]} days={days} />
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="huni" className={card}>
          <h2 id="huni" className="font-semibold text-slate-900">Dönüşüm hunisi</h2>
          <p className="mt-0.5 text-sm text-slate-600">Bu dönemde açılan talepler bugüne kadar nereye ulaştı.</p>
          <ol className="mt-4 space-y-3">
            {funnel.map((s) => (
              <li key={s.label}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-800">{s.label}</span>
                  <span className="text-slate-600 tabular-nums">
                    <span className="font-semibold text-slate-900">{formatNumber(s.value)}</span>
                    {s.note && ` · ${s.note} ${formatPercent(s.rate)}`}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Bar value={s.value} max={f.requests} label={`${s.label}: ${formatNumber(s.value)}`} />
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="ortalamalar" className={card}>
          <h2 id="ortalamalar" className="font-semibold text-slate-900">Ortalamalar</h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5">
            <div>
              <dt className="text-sm text-slate-600">Talep başına teklif</dt>
              <dd className="mt-0.5 text-xl font-bold text-slate-900 tabular-nums">
                {stats.averages.quotesPerRequest === null ? "—" : stats.averages.quotesPerRequest.toLocaleString("tr-TR")}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-600">Ortalama anlaşma tutarı</dt>
              <dd className="mt-0.5 text-xl font-bold text-slate-900 tabular-nums">
                {stats.averages.acceptedPriceTry === null ? "—" : formatMoney(stats.averages.acceptedPriceTry)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-600">Toplam anlaşma tutarı</dt>
              <dd className="mt-0.5 text-xl font-bold text-slate-900 tabular-nums">{formatMoney(stats.averages.acceptedTotalTry)}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-600">Ortalama puan</dt>
              <dd className="mt-0.5 text-xl font-bold text-slate-900 tabular-nums">
                {stats.ratings.average === null ? "—" : `${stats.ratings.average.toLocaleString("tr-TR")} / 5`}
                <span className="ml-1.5 text-sm font-normal text-slate-600">{formatNumber(stats.ratings.count)} yorum</span>
              </dd>
            </div>
          </dl>
          <h3 className="mt-6 text-sm font-semibold text-slate-800">Puan dağılımı</h3>
          <ul className="mt-2 space-y-1.5">
            {stats.ratings.distribution.map((r) => (
              <li key={r.rating} className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                <span className="text-slate-700">{r.rating} yıldız</span>
                <Bar value={r.count} max={maxRating} label={`${r.rating} yıldız: ${r.count}`} />
                <span className="text-right text-slate-900 tabular-nums">{formatNumber(r.count)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="gunluk" className="mt-6">
        <h2 id="gunluk" className="mb-2 font-semibold text-slate-900">Günlük</h2>
        <div className="grid gap-4 xl:grid-cols-3">
          <DailyColumns title="Yeni talep" unit="talep" points={stats.daily.map((d) => ({ day: d.day, value: d.requests }))} />
          <DailyColumns title="Verilen teklif" unit="teklif" points={stats.daily.map((d) => ({ day: d.day, value: d.quotes }))} />
          <DailyColumns title="Anlaşılan iş" unit="iş" points={stats.daily.map((d) => ({ day: d.day, value: d.bookings }))} />
        </div>
        <details className="mt-3 rounded-xl border border-slate-200 bg-white text-sm shadow-sm">
          <summary className="cursor-pointer px-4 py-2.5 font-medium text-brand-700">Günlük sayıları tablo olarak göster</summary>
          <div className="max-h-96 overflow-auto border-t border-slate-200">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2">Gün</th>
                  <th scope="col" className="px-4 py-2 text-right">Talep</th>
                  <th scope="col" className="px-4 py-2 text-right">Teklif</th>
                  <th scope="col" className="px-4 py-2 text-right">İş</th>
                </tr>
              </thead>
              <tbody>
                {[...stats.daily].reverse().map((d) => (
                  <tr key={d.day} className="border-t border-slate-100">
                    <th scope="row" className="px-4 py-1.5 font-normal text-slate-700">{formatDay(d.day)}</th>
                    <td className="px-4 py-1.5 text-right tabular-nums">{d.requests}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{d.quotes}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{d.bookings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section aria-labelledby="iller" className={`mt-6 ${card}`}>
        <h2 id="iller" className="font-semibold text-slate-900">En çok talep gelen iller</h2>
        <p className="mt-0.5 text-sm text-slate-600">Çıkış iline göre, bu dönemde açılan talepler.</p>
        {stats.cities.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Bu dönemde talep yok.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="py-2 pr-3">İl</th>
                  <th scope="col" className="hidden w-1/2 py-2 pr-3 sm:table-cell"><span className="sr-only">Talep çubuğu</span></th>
                  <th scope="col" className="py-2 pr-3 text-right">Talep</th>
                  <th scope="col" className="py-2 pr-3 text-right">Seçilen</th>
                  <th scope="col" className="py-2 text-right">Dönüşüm</th>
                </tr>
              </thead>
              <tbody>
                {stats.cities.map((c) => (
                  <tr key={c.code} className="border-t border-slate-100">
                    <th scope="row" className="py-2 pr-3 font-medium text-slate-800">{c.name}</th>
                    <td className="hidden py-2 pr-3 sm:table-cell">
                      <Bar value={c.requests} max={maxCity} label={`${c.name}: ${c.requests} talep`} />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(c.requests)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(c.booked)}</td>
                    <td className="py-2 text-right tabular-nums">{formatPercent(c.booked / c.requests)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
