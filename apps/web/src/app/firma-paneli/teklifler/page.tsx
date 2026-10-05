import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, EmptyRow, FilterTabs, PageHeader, Pager, query, td, th } from "@/components/panel/panel-bits";
import { apiFetch, type CompanyQuote, type OwnQuote, type Paginated } from "@/lib/api";
import { getCompanyContext } from "@/lib/company";
import { formatDate, formatMoney } from "@/lib/format";
import { oneParam, pageParam } from "@/lib/params";
import { VEHICLE_LABELS, homeTypeLabel } from "@/lib/request-options";
import { QuoteBadge, route } from "../request-bits";

export const metadata: Metadata = { title: "Tekliflerim" };

const FILTERS: { value: string; label: string; status?: OwnQuote["status"] }[] = [
  { value: "tumu", label: "Tümü" },
  { value: "bekleyen", label: "Bekleyen", status: "PENDING" },
  { value: "kabul-edilen", label: "Kabul edilen", status: "ACCEPTED" },
  { value: "secilmeyen", label: "Başka firma seçildi", status: "REJECTED" },
  { value: "suresi-dolan", label: "Süresi doldu", status: "EXPIRED" },
  { value: "geri-cekilen", label: "Geri çekilen", status: "WITHDRAWN" },
];
const LIMIT = 25;

/** Verdiğin teklifler, en yeni önce */
export default async function CompanyQuotesPage({ searchParams }: PageProps<"/firma-paneli/teklifler">) {
  const { token, profile } = await getCompanyContext();
  if (!profile) return null;
  const params = await searchParams;
  const filter = FILTERS.find((f) => f.value === oneParam(params.durum)) ?? FILTERS[0];
  const page = pageParam(params.sayfa);
  const { items, total } = await apiFetch<Paginated<CompanyQuote>>(
    `/company/quotes${query({ status: filter.status, page, limit: LIMIT })}`,
    { token },
  );
  const href = (durum: string, sayfa = 1) =>
    `/firma-paneli/teklifler${query({ durum: durum === "tumu" ? undefined : durum, sayfa })}`;

  return (
    <>
      <PageHeader title="Tekliflerim" description="Verdiğin teklifler ve sonuçları, en yeni önce." />
      <div className="mb-4">
        <FilterTabs
          label="Teklif durumu"
          current={filter.value}
          options={FILTERS.map((f) => ({ value: f.value, label: f.label, href: href(f.value) }))}
        />
      </div>

      <DataTable label="Tekliflerim">
        <thead>
          <tr>
            <th scope="col" className={th}>Güzergâh</th>
            <th scope="col" className={th}>Taşınma</th>
            <th scope="col" className={th}>Teklif</th>
            <th scope="col" className={th}>Ekip ve araç</th>
            <th scope="col" className={th}>Durum</th>
            <th scope="col" className={th}>Verildi</th>
            <th scope="col" className={th}>Geçerlilik</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <EmptyRow colSpan={7}>
              {filter.value === "tumu" ? (
                <>
                  Henüz teklif vermedin.{" "}
                  <Link href="/firma-paneli/talepler" className="font-medium text-brand-700 hover:underline">
                    Gelen taleplere göz at
                  </Link>
                  .
                </>
              ) : (
                "Bu süzgece uyan teklif yok."
              )}
            </EmptyRow>
          )}
          {items.map((q) => (
            <tr key={q.id} className="hover:bg-slate-50">
              <td className={td}>
                <Link href={`/firma-paneli/talepler/${q.request.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                  {route(q.request)}
                </Link>
                <div className="text-xs text-slate-500">{homeTypeLabel(q.request.homeType)}</div>
              </td>
              <td className={`${td} whitespace-nowrap`}>{formatDate(q.request.moveDate)}</td>
              <td className={`${td} whitespace-nowrap font-semibold tabular-nums`}>{formatMoney(q.priceTry)}</td>
              <td className={`${td} text-slate-600`}>
                {q.crewSize} kişi · {VEHICLE_LABELS[q.vehicleType] ?? q.vehicleType}
              </td>
              <td className={td}>
                <QuoteBadge quote={q} hidePrice />
              </td>
              <td className={`${td} whitespace-nowrap text-slate-600`}>{formatDate(q.createdAt)}</td>
              <td className={`${td} whitespace-nowrap text-slate-600`}>{formatDate(q.validUntil)}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      <Pager page={page} limit={LIMIT} total={total} href={(p) => href(filter.value, p)} />
    </>
  );
}
