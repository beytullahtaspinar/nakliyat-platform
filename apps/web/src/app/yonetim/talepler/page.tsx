import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { getAdminContext, oneParam, pageParam } from "@/lib/admin";
import { apiFetch, type AdminRequest, type Paginated, type RequestStatus } from "@/lib/api";
import { formatDate, formatPhone, place } from "@/lib/format";
import { REQUEST_STATUS, homeTypeLabel } from "@/lib/request-options";
import { FilterTabs, Pager, query } from "../admin-bits";

export const metadata: Metadata = { title: "Talepler" };

const FILTERS: { value: string; label: string; status?: RequestStatus }[] = [
  { value: "tumu", label: "Tümü" },
  { value: "acik", label: "Teklif bekliyor", status: "OPEN" },
  { value: "firma-secildi", label: "Firma seçildi", status: "BOOKED" },
  { value: "tamamlandi", label: "Tamamlandı", status: "COMPLETED" },
  { value: "iptal", label: "İptal", status: "CANCELLED" },
  { value: "suresi-doldu", label: "Süresi doldu", status: "EXPIRED" },
];
const LIMIT = 20;

export default async function AdminRequestsPage({ searchParams }: PageProps<"/yonetim/talepler">) {
  const { token } = await getAdminContext();
  const params = await searchParams;
  const filter = FILTERS.find((f) => f.value === oneParam(params.durum)) ?? FILTERS[0];
  const page = pageParam(params.sayfa);
  const { items, total } = await apiFetch<Paginated<AdminRequest>>(
    `/admin/requests${query({ status: filter.status, page, limit: LIMIT })}`,
    { token },
  );
  const href = (durum: string, sayfa = 1) =>
    `/yonetim/talepler${query({ durum: durum === "tumu" ? undefined : durum, sayfa })}`;

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Talepler</h1>
      <p className="mt-1 text-sm text-zinc-600">{total} talep, en yenisi önce.</p>
      <div className="mt-4">
        <FilterTabs
          label="Talep durumu"
          current={filter.value}
          options={FILTERS.map((f) => ({ value: f.value, label: f.label, href: href(f.value) }))}
        />
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-zinc-600">Bu durumda talep yok.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {items.map((r) => {
            const status = REQUEST_STATUS[r.status];
            return (
              <li key={r.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold">
                      {place(r.fromCityName, r.fromDistrictName)} → {place(r.toCityName, r.toDistrictName)}
                    </p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-600">
                    {homeTypeLabel(r.homeType)} · taşınma {formatDate(r.moveDate)}
                    {r.distanceKm ? ` · ${r.distanceKm} km` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
                    <span>
                      {r.customer.fullName} ·{" "}
                      <a href={`tel:${r.customer.phone}`} className="font-medium text-brand-700 hover:underline">
                        {formatPhone(r.customer.phone)}
                      </a>
                    </span>
                    <span className="text-zinc-500">
                      {r.quoteCount} teklif · açıldı {formatDate(r.createdAt)}
                    </span>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={page} limit={LIMIT} total={total} href={(p) => href(filter.value, p)} />
    </>
  );
}
