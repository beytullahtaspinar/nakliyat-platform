import type { Metadata } from "next";
import Link from "next/link";
import { ActionsMenu } from "@/components/panel/actions-menu";
import { DataTable, EmptyRow, PageHeader, Pager, SearchForm, query, td, th } from "@/components/panel/panel-bits";
import { apiFetch, type CompanyCustomer, type Paginated } from "@/lib/api";
import { getCompanyContext } from "@/lib/company";
import { formatDate, formatMoney, formatPhone } from "@/lib/format";
import { oneParam, pageParam } from "@/lib/params";
import { BookingStatusBadge, bookingRoute } from "../booking-bits";

export const metadata: Metadata = { title: "Müşteriler" };

const LIMIT = 25;

/** Teklifini kabul eden müşteriler: iş sayısı, toplam tutar ve son taşınma. En son taşınan önce. */
export default async function CompanyCustomersPage({ searchParams }: PageProps<"/firma-paneli/musteriler">) {
  const { token, profile } = await getCompanyContext();
  if (!profile) return null;
  const params = await searchParams;
  const q = oneParam(params.ara)?.trim().slice(0, 100) || undefined;
  const page = pageParam(params.sayfa);
  const { items, total } = await apiFetch<Paginated<CompanyCustomer>>(`/company/customers${query({ q, page, limit: LIMIT })}`, {
    token,
  });

  return (
    <>
      <PageHeader
        title="Müşteriler"
        description="Teklifini kabul eden müşterilerin. Tutar, iptal edilmeyen işlerin toplamıdır."
        actions={<SearchForm action="/firma-paneli/musteriler" q={q} placeholder="Müşteri adı ya da telefonu" />}
      />

      <DataTable label="Müşteriler">
        <thead>
          <tr>
            <th scope="col" className={th}>Müşteri</th>
            <th scope="col" className={th}>İş</th>
            <th scope="col" className={th}>Toplam</th>
            <th scope="col" className={th}>Son taşınma</th>
            <th scope="col" className={th}>Son durum</th>
            <th scope="col" className={th}><span className="sr-only">İşlemler</span></th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <EmptyRow colSpan={6}>
              {q ? "Bu aramaya uyan müşteri yok." : "Henüz müşterin yok. Teklifin kabul edildiğinde müşteri burada listelenir."}
            </EmptyRow>
          )}
          {items.map((c) => {
            const phone = formatPhone(c.phone);
            const jobs = `/firma-paneli/isler${query({ ara: phone })}`;
            return (
              <tr key={c.phone} className="hover:bg-slate-50">
                <td className={td}>
                  <Link href={jobs} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                    {c.fullName}
                  </Link>
                  <div>
                    <a href={`tel:${c.phone}`} className="text-xs font-medium whitespace-nowrap text-brand-700 hover:underline">
                      {phone}
                    </a>
                  </div>
                </td>
                <td className={`${td} tabular-nums`}>
                  {c.bookingCount}
                  {c.activeCount > 0 && <div className="text-xs text-slate-500">{c.activeCount} planlı</div>}
                </td>
                <td className={`${td} whitespace-nowrap tabular-nums`}>{formatMoney(c.totalTry)}</td>
                <td className={td}>
                  <Link href={`/firma-paneli/isler/${c.lastBooking.id}`} className="whitespace-nowrap text-slate-900 hover:text-brand-700 hover:underline">
                    {formatDate(c.lastBooking.scheduledAt)}
                  </Link>
                  <div className="text-xs text-slate-500">{bookingRoute(c.lastBooking.from, c.lastBooking.to)}</div>
                </td>
                <td className={td}>
                  <BookingStatusBadge status={c.lastBooking.status} />
                </td>
                <td className={`${td} text-right`}>
                  <ActionsMenu
                    label={`İşlemler: ${c.fullName}`}
                    actions={[
                      { label: "İşlerini gör", href: jobs },
                      { label: "Son işe git", href: `/firma-paneli/isler/${c.lastBooking.id}` },
                      { label: "Ara", href: `tel:${c.phone}` },
                    ]}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
      <Pager page={page} limit={LIMIT} total={total} href={(p) => `/firma-paneli/musteriler${query({ ara: q, sayfa: p })}`} />
    </>
  );
}
