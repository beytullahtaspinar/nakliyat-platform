import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getAdminContext, oneParam, pageParam } from "@/lib/admin";
import { apiFetch, type AdminVehicle, type Paginated, type VerificationStatus } from "@/lib/api";
import { FilterTabs, PageHeader, Pager, SearchForm, VerificationBadge, query } from "../admin-bits";
import { VehicleInspection } from "../vehicle-inspection";

export const metadata: Metadata = { title: "Araçlar" };

const FILTERS: { value: string; label: string; status?: VerificationStatus }[] = [
  { value: "bekleyen", label: "Onay bekleyen", status: "PENDING" },
  { value: "reddedilen", label: "Reddedilen", status: "REJECTED" },
  { value: "onayli", label: "Onaylı", status: "VERIFIED" },
  { value: "tumu", label: "Tümü" },
];
const LIMIT = 10;

/**
 * Firmaların araçları. Varsayılan liste onay bekleyenler (en eski önce). Ruhsat ve üç fotoğraf yan yana:
 * ruhsattaki plaka fotoğraflardaki plakayla aynıysa onaylanır, değilse gerekçeyle reddedilir.
 */
export default async function AdminVehiclesPage({ searchParams }: PageProps<"/yonetim/araclar">) {
  const { token } = await getAdminContext();
  const params = await searchParams;
  const q = oneParam(params.ara)?.trim().slice(0, 100) || undefined;
  const filter = FILTERS.find((f) => f.value === oneParam(params.durum)) ?? (q ? FILTERS[3] : FILTERS[0]);
  const page = pageParam(params.sayfa);
  const { items, total } = await apiFetch<Paginated<AdminVehicle>>(
    `/admin/vehicles${query({ status: filter.status, q, page, limit: LIMIT })}`,
    { token },
  );
  const href = (durum: string, sayfa = 1) =>
    `/yonetim/araclar${query({ durum: durum === "bekleyen" && !q ? undefined : durum, ara: q, sayfa })}`;

  return (
    <>
      <PageHeader
        title="Araçlar"
        description="Firmaların yetki belgesine kayıtlı araçları. Ruhsattaki plakayı önden, yandan ve arkadan fotoğraflardaki plakayla karşılaştırın; görsele tıklayınca tam boyutu açılır."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label="Araç durumu"
          current={filter.value}
          options={FILTERS.map((f) => ({ value: f.value, label: f.label, href: href(f.value) }))}
        />
        <SearchForm
          action="/yonetim/araclar"
          q={q}
          placeholder="Plaka, firma adı veya vergi no"
          keep={{ durum: oneParam(params.durum) }}
        />
      </div>

      {items.length === 0 ? (
        <Card className="p-6 text-sm text-slate-600">
          {filter.status === "PENDING" ? "Onay bekleyen araç yok." : "Bu süzgece uyan araç yok."}
        </Card>
      ) : (
        <ul className="space-y-4">
          {items.map((v) => (
            <li key={v.id}>
              <Card className="p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
                  <Link
                    href={`/yonetim/firmalar/${v.company.id}`}
                    className="font-semibold text-slate-900 hover:text-brand-700 hover:underline"
                  >
                    {v.company.displayName}
                  </Link>
                  <span className="text-sm text-slate-500">{v.company.legalName}</span>
                  <span className="ml-auto">
                    <VerificationBadge status={v.company.verificationStatus} />
                  </span>
                </div>
                <VehicleInspection companyId={v.company.id} vehicle={v} />
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} limit={LIMIT} total={total} href={(p) => href(filter.value, p)} />
    </>
  );
}
