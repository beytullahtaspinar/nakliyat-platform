import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getAdminContext, oneParam, pageParam } from "@/lib/admin";
import { apiFetch, type AdminCompany, type Paginated, type VerificationStatus } from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/format";
import { FilterTabs, Pager, VerificationBadge, query } from "../admin-bits";

export const metadata: Metadata = { title: "Firmalar" };

const FILTERS: { value: string; label: string; status?: VerificationStatus }[] = [
  { value: "bekleyen", label: "Onay bekleyen", status: "PENDING" },
  { value: "onayli", label: "Onaylı", status: "VERIFIED" },
  { value: "reddedilen", label: "Reddedilen", status: "REJECTED" },
  { value: "tumu", label: "Tümü" },
];
const LIMIT = 20;

export default async function AdminCompaniesPage({ searchParams }: PageProps<"/yonetim/firmalar">) {
  const { token } = await getAdminContext();
  const params = await searchParams;
  const filter = FILTERS.find((f) => f.value === oneParam(params.durum)) ?? FILTERS[0];
  const page = pageParam(params.sayfa);
  const { items, total } = await apiFetch<Paginated<AdminCompany>>(
    `/admin/companies${query({ status: filter.status, page, limit: LIMIT })}`,
    { token },
  );
  const href = (durum: string, sayfa = 1) =>
    `/yonetim/firmalar${query({ durum: durum === "bekleyen" ? undefined : durum, sayfa })}`;

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Firmalar</h1>
      <div className="mt-4">
        <FilterTabs
          label="Firma durumu"
          current={filter.value}
          options={FILTERS.map((f) => ({ value: f.value, label: f.label, href: href(f.value) }))}
        />
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-zinc-600">Bu durumda firma yok.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {items.map((c) => (
            <li key={c.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link href={`/yonetim/firmalar/${c.id}`} className="font-semibold hover:underline">
                      {c.displayName}
                    </Link>
                    <p className="text-sm text-zinc-600">{c.legalName}</p>
                  </div>
                  <VerificationBadge status={c.verificationStatus} />
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <Fact label="Vergi no" value={c.taxNumber} />
                  <Fact label="K3 belge no" value={c.k3LicenseNumber ?? "Girilmemiş"} />
                  <Fact label="Merkez" value={c.cityName ?? c.cityCode} />
                  <Fact label="Yetkili" value={`${c.owner.fullName} · ${formatPhone(c.owner.phone)}`} />
                </dl>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-zinc-500">Başvuru {formatDate(c.createdAt)}</span>
                  <Link href={`/yonetim/firmalar/${c.id}`} className="font-semibold text-brand-700 hover:underline">
                    {c.verificationStatus === "PENDING" ? "İncele ve karar ver →" : "Detay →"}
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} limit={LIMIT} total={total} href={(p) => href(filter.value, p)} />
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-zinc-500">{label}:</dt>
      <dd className="font-medium text-zinc-800">{value}</dd>
    </div>
  );
}
