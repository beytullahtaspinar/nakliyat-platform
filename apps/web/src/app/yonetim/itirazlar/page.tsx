import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/card";
import { getAdminContext, oneParam, pageParam } from "@/lib/admin";
import { apiFetch, type AdminDispute, type Paginated } from "@/lib/api";
import { formatDate, formatDateTime, formatMoney, formatPhone } from "@/lib/format";
import { DataTable, EmptyRow, FilterTabs, PageHeader, Pager, query, td, th } from "../admin-bits";
import { DisputeResolve } from "./dispute-resolve";

export const metadata: Metadata = { title: "İtirazlar" };

const FILTERS = [
  { value: "bekleyen", label: "Bekleyen", status: "open" },
  { value: "sonuclanan", label: "Sonuçlanan", status: "resolved" },
] as const;
const LIMIT = 25;

/**
 * "Taşınma yapılmadı" itirazları. İtirazlı iş kendiliğinden tamamlanmaz; taraflarla (gerekirse mesajlarına bakarak)
 * görüşüp taşınmanın yapılıp yapılmadığına karar ver. Kurallar: docs/tasinma-sonrasi.md
 */
export default async function AdminDisputesPage({ searchParams }: PageProps<"/yonetim/itirazlar">) {
  const { token } = await getAdminContext();
  const params = await searchParams;
  const filter = FILTERS.find((f) => f.value === oneParam(params.durum)) ?? FILTERS[0];
  const page = pageParam(params.sayfa);
  const { items, total } = await apiFetch<Paginated<AdminDispute>>(
    `/admin/bookings/disputes${query({ status: filter.status, page, limit: LIMIT })}`,
    { token },
  );
  const href = (durum: string, sayfa = 1) => `/yonetim/itirazlar${query({ durum: durum === "bekleyen" ? undefined : durum, sayfa })}`;
  const open = filter.status === "open";

  return (
    <>
      <PageHeader
        title="İtirazlar"
        description="Müşterinin ya da firmanın 'taşınma yapılmadı' dediği işler. İtirazlı iş kendiliğinden tamamlanmaz; iki tarafla görüşüp karar ver."
      />
      <div className="mb-4">
        <FilterTabs
          label="İtiraz durumu"
          current={filter.value}
          options={FILTERS.map((f) => ({ value: f.value, label: f.status === "open" && open ? `${f.label} (${total})` : f.label, href: href(f.value) }))}
        />
      </div>

      <DataTable label={open ? "Bekleyen itirazlar, en eski önce" : "Sonuçlanan itirazlar"} minWidth={960}>
        <thead>
          <tr>
            <th scope="col" className={`${th} w-44`}>Taşınma</th>
            <th scope="col" className={th}>İtiraz</th>
            <th scope="col" className={`${th} w-48`}>Müşteri</th>
            <th scope="col" className={`${th} w-48`}>Firma</th>
            <th scope="col" className={`${th} w-28`}>
              <span className="sr-only">İşlem</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && <EmptyRow colSpan={5}>{open ? "Bekleyen itiraz yok." : "Sonuçlanan itiraz yok."}</EmptyRow>}
          {items.map((d) => (
            <tr key={d.id} className="hover:bg-slate-50">
              <td className={td}>
                <span className="block font-medium text-slate-900">{formatDate(d.scheduledAt)}</span>
                <span className="block text-xs text-slate-600">
                  {d.from} → {d.to}
                </span>
                <span className="block text-xs text-slate-600">{formatMoney(d.priceTry)}</span>
                <Link href={`/yonetim/talepler/${d.requestId}`} className="mt-1 inline-block text-xs font-medium text-brand-700 hover:underline">
                  Talebi aç
                </Link>
              </td>
              <td className={td}>
                <Badge tone="warning">{d.disputedBy === "COMPANY" ? "Firma itiraz etti" : "Müşteri itiraz etti"}</Badge>
                {d.disputedAt && <span className="ml-2 text-xs text-slate-500">{formatDateTime(d.disputedAt)}</span>}
                <p className="mt-1.5 text-sm whitespace-pre-line text-slate-900">{d.disputeReason}</p>
                <p className="mt-1 text-xs text-slate-500">Konuşmada {d.messageCount} mesaj var.</p>
                {!open && d.disputeResolution && (
                  <p className="mt-1.5 text-xs text-slate-600">
                    {d.disputeResolvedAt && <span className="text-slate-500">{formatDateTime(d.disputeResolvedAt)} · </span>}
                    {d.disputeResolution}
                  </p>
                )}
              </td>
              <td className={td}>
                <Link href={`/yonetim/kullanicilar/${d.customer.id}`} className="font-medium text-slate-900 hover:underline">
                  {d.customer.fullName}
                </Link>
                <span className="block text-xs text-slate-600">{formatPhone(d.customer.phone)}</span>
              </td>
              <td className={td}>
                <Link href={`/yonetim/firmalar/${d.company.id}`} className="font-medium text-slate-900 hover:underline">
                  {d.company.displayName}
                </Link>
                <span className="block text-xs text-slate-600">{formatPhone(d.company.phone)}</span>
              </td>
              <td className={`${td} text-right`}>
                {open ? (
                  <DisputeResolve bookingId={d.id} label={`${formatDate(d.scheduledAt)} · ${d.customer.fullName} · ${d.company.displayName}`} />
                ) : (
                  <Badge tone={d.status === "COMPLETED" ? "success" : "neutral"}>{d.status === "COMPLETED" ? "Yapıldı" : "İptal edildi"}</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      <Pager page={page} limit={LIMIT} total={total} href={(p) => href(filter.value, p)} />
    </>
  );
}
