import type { Metadata } from "next";
import Link from "next/link";
import { getAdminContext, oneParam, pageParam } from "@/lib/admin";
import { apiFetch, type AdminRequest, type Paginated, type RequestStatus } from "@/lib/api";
import { formatDate, formatPhone, place } from "@/lib/format";
import { REQUEST_STATUS, homeTypeLabel } from "@/lib/request-options";
import { DataTable, EmptyRow, FilterTabs, PageHeader, Pager, SearchForm, query, td, th } from "../admin-bits";

export const metadata: Metadata = { title: "Talepler" };

const FILTERS: { value: string; label: string; status?: RequestStatus }[] = [
  { value: "tumu", label: "Tümü" },
  { value: "acik", label: "Teklif bekliyor", status: "OPEN" },
  { value: "firma-secildi", label: "Firma seçildi", status: "BOOKED" },
  { value: "tamamlandi", label: "Tamamlandı", status: "COMPLETED" },
  { value: "iptal", label: "İptal", status: "CANCELLED" },
  { value: "suresi-doldu", label: "Süresi doldu", status: "EXPIRED" },
];
const LIMIT = 25;

export default async function AdminRequestsPage({ searchParams }: PageProps<"/yonetim/talepler">) {
  const { token } = await getAdminContext();
  const params = await searchParams;
  const filter = FILTERS.find((f) => f.value === oneParam(params.durum)) ?? FILTERS[0];
  const q = oneParam(params.ara)?.trim().slice(0, 100) || undefined;
  const page = pageParam(params.sayfa);
  const { items, total } = await apiFetch<Paginated<AdminRequest>>(
    `/admin/requests${query({ status: filter.status, q, page, limit: LIMIT })}`,
    { token },
  );
  const href = (durum: string, sayfa = 1) =>
    `/yonetim/talepler${query({ durum: durum === "tumu" ? undefined : durum, ara: q, sayfa })}`;

  return (
    <>
      <PageHeader title="Talepler" description="Müşterilerin açtığı taşıma talepleri, en yenisi önce." />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label="Talep durumu"
          current={filter.value}
          options={FILTERS.map((f) => ({ value: f.value, label: f.label, href: href(f.value) }))}
        />
        <SearchForm action="/yonetim/talepler" q={q} placeholder="Müşteri adı veya telefon" keep={{ durum: oneParam(params.durum) }} />
      </div>

      <DataTable label="Talepler">
        <thead>
          <tr>
            <th scope="col" className={th}>Güzergâh</th>
            <th scope="col" className={th}>Müşteri</th>
            <th scope="col" className={th}>Ev</th>
            <th scope="col" className={th}>Taşınma</th>
            <th scope="col" className={th}>Teklif</th>
            <th scope="col" className={th}>Durum</th>
            <th scope="col" className={th}>Açıldı</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && <EmptyRow colSpan={7}>Bu süzgece uyan talep yok.</EmptyRow>}
          {items.map((r) => {
            const status = REQUEST_STATUS[r.status];
            return (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className={td}>
                  <Link href={`/yonetim/talepler/${r.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                    {place(r.fromCityName, r.fromDistrictName)} → {place(r.toCityName, r.toDistrictName)}
                  </Link>
                  {r.distanceKm ? <div className="text-xs text-slate-500">{r.distanceKm} km</div> : null}
                </td>
                <td className={td}>
                  {r.customer.fullName}
                  <div className="text-xs text-slate-500">{formatPhone(r.customer.phone)}</div>
                </td>
                <td className={td}>{homeTypeLabel(r.homeType)}</td>
                <td className={`${td} whitespace-nowrap`}>{formatDate(r.moveDate)}</td>
                <td className={`${td} tabular-nums`}>{r.quoteCount}</td>
                <td className={td}>
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </td>
                <td className={`${td} whitespace-nowrap text-slate-600`}>{formatDate(r.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
      <Pager page={page} limit={LIMIT} total={total} href={(p) => href(filter.value, p)} />
    </>
  );
}
