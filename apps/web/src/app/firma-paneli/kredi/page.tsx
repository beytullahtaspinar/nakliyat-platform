import type { Metadata } from "next";
import Link from "next/link";
import { CreditTable } from "@/components/credits/credit-table";
import { FilterTabs, PageHeader, Pager, PanelSection, query } from "@/components/panel/panel-bits";
import { apiFetch, type Paginated } from "@/lib/api";
import { getCompanyContext } from "@/lib/company";
import { CREDIT_FILTERS, formatCredits, type CompanyCreditSummary, type CreditTransaction } from "@/lib/credits";
import { COMPANY } from "@/lib/legal";
import { oneParam, pageParam } from "@/lib/params";

export const metadata: Metadata = { title: "Kredi" };

const LIMIT = 25;

/** Kredi bakiyesi, teklif başına kredi ve hareketler */
export default async function CompanyCreditsPage({ searchParams }: PageProps<"/firma-paneli/kredi">) {
  const { token, profile } = await getCompanyContext();
  if (!profile) return null;
  const params = await searchParams;
  const filter = CREDIT_FILTERS.find((f) => f.value === oneParam(params.tur)) ?? CREDIT_FILTERS[0];
  const page = pageParam(params.sayfa);
  const [summary, { items, total }] = await Promise.all([
    apiFetch<CompanyCreditSummary>("/company/credits", { token }),
    apiFetch<Paginated<CreditTransaction>>(`/company/credits/transactions${query({ type: filter.type, page, limit: LIMIT })}`, { token }),
  ]);
  const href = (tur: string, sayfa = 1) => `/firma-paneli/kredi${query({ tur: tur === "tumu" ? undefined : tur, sayfa })}`;
  const low = summary.enabled && summary.balance < summary.lowBalanceThreshold;

  const facts = [
    {
      label: "Bakiye",
      value: formatCredits(summary.balance),
      hint: low ? "Bakiyen azaldı" : summary.enabled ? `${Math.floor(summary.balance / Math.max(summary.quoteCostLocal, 1))} şehir içi teklife yeter` : null,
      warn: low,
    },
    { label: "Şehir içi teklif", value: formatCredits(summary.quoteCostLocal), hint: "Aynı il içindeki talep" },
    { label: "Şehirler arası teklif", value: formatCredits(summary.quoteCostIntercity), hint: "İller arası talep" },
  ];

  return (
    <>
      <PageHeader title="Kredi" description="Taleplere teklif verirken kredi kullanılır. Teklifi güncellemek ücretsizdir." />

      {!summary.enabled && (
        <p role="status" className="mb-5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <strong>Teklif vermek şu an ücretsiz.</strong> Kredi sistemi açıldığında her teklifte aşağıdaki kredi düşecek; bunu önceden
          duyuracağız.
        </p>
      )}

      <dl className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {facts.map((f) => (
          <div
            key={f.label}
            className={`rounded-xl border bg-white p-4 shadow-sm ${f.warn ? "border-amber-300 ring-1 ring-amber-300" : "border-slate-200"}`}
          >
            <dt className="text-xs font-semibold tracking-wide text-slate-600 uppercase">{f.label}</dt>
            <dd className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{f.value}</dd>
            {f.hint && <dd className={`mt-0.5 text-sm ${f.warn ? "font-medium text-amber-900" : "text-slate-600"}`}>{f.hint}</dd>}
          </div>
        ))}
      </dl>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PanelSection id="yukleme" title="Kredi yükle">
          <p className="text-sm text-slate-700">
            Kredi kartı ve havale/EFT ile yükleme yakında bu sayfada olacak. Şimdilik kredi için{" "}
            <a href={`mailto:${COMPANY.supportEmail}`} className="font-medium text-brand-700 hover:underline">
              {COMPANY.supportEmail}
            </a>{" "}
            adresine yaz.
          </p>
        </PanelSection>
        <PanelSection id="kurallar" title="Kredi ne zaman düşer, ne zaman iade edilir?">
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Teklif gönderdiğinde düşer. Teklifi güncellemek ücretsizdir.</li>
            <li>Müşteri talebini iptal ederse kredin tamamen iade edilir.</li>
            <li>Teklifini geri çekersen ya da müşteri başka firmayı seçerse iade edilmez.</li>
          </ul>
        </PanelSection>
      </div>

      <h2 className="mb-3 text-base font-semibold text-slate-900">Hareketler</h2>
      <div className="mb-4">
        <FilterTabs
          label="Hareket türü"
          current={filter.value}
          options={CREDIT_FILTERS.map((f) => ({ value: f.value, label: f.label, href: href(f.value) }))}
        />
      </div>
      <CreditTable
        items={items}
        empty={
          filter.value === "tumu" ? (
            <>
              Henüz kredi hareketin yok.{" "}
              <Link href="/firma-paneli/talepler" className="font-medium text-brand-700 hover:underline">
                Gelen taleplere göz at
              </Link>
              .
            </>
          ) : (
            "Bu süzgece uyan hareket yok."
          )
        }
      />
      <Pager page={page} limit={LIMIT} total={total} href={(p) => href(filter.value, p)} />
    </>
  );
}
