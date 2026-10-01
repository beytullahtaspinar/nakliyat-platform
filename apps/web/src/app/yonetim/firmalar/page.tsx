import type { Metadata } from "next";
import Link from "next/link";
import { getAdminContext, oneParam, pageParam } from "@/lib/admin";
import { apiFetch, type AdminCompany, type Paginated, type VerificationStatus } from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/format";
import { DataTable, EmptyRow, FilterTabs, PageHeader, Pager, SearchForm, VerificationBadge, query, td, th } from "../admin-bits";

export const metadata: Metadata = { title: "Firmalar" };

const FILTERS: { value: string; label: string; status?: VerificationStatus }[] = [
  { value: "bekleyen", label: "Onay bekleyen", status: "PENDING" },
  { value: "onayli", label: "Onaylı", status: "VERIFIED" },
  { value: "reddedilen", label: "Reddedilen", status: "REJECTED" },
  { value: "tumu", label: "Tümü" },
];
const LIMIT = 25;

export default async function AdminCompaniesPage({ searchParams }: PageProps<"/yonetim/firmalar">) {
  const { token } = await getAdminContext();
  const params = await searchParams;
  const q = oneParam(params.ara)?.trim().slice(0, 100) || undefined;
  // Arama yapılınca varsayılan süzgeç "Tümü" olur; aranan firma hangi durumda olursa bulunur
  const filter =
    FILTERS.find((f) => f.value === oneParam(params.durum)) ?? (q ? FILTERS[3] : FILTERS[0]);
  const page = pageParam(params.sayfa);
  const { items, total } = await apiFetch<Paginated<AdminCompany>>(
    `/admin/companies${query({ status: filter.status, q, page, limit: LIMIT })}`,
    { token },
  );
  const href = (durum: string, sayfa = 1) =>
    `/yonetim/firmalar${query({ durum: durum === "bekleyen" && !q ? undefined : durum, ara: q, sayfa })}`;

  return (
    <>
      <PageHeader title="Firmalar" description="Firma başvuruları, doğrulama durumu ve iletişim bilgileri." />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label="Firma durumu"
          current={filter.value}
          options={FILTERS.map((f) => ({ value: f.value, label: f.label, href: href(f.value) }))}
        />
        <SearchForm
          action="/yonetim/firmalar"
          q={q}
          placeholder="Firma adı, unvan, vergi no, K3 veya telefon"
          keep={{ durum: oneParam(params.durum) }}
        />
      </div>

      <DataTable label="Firmalar">
        <thead>
          <tr>
            <th scope="col" className={th}>Firma</th>
            <th scope="col" className={th}>Vergi no</th>
            <th scope="col" className={th}>K3 belge no</th>
            <th scope="col" className={th}>Merkez</th>
            <th scope="col" className={th}>Yetkili</th>
            <th scope="col" className={th}>Durum</th>
            <th scope="col" className={th}>Başvuru</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && <EmptyRow colSpan={7}>Bu süzgece uyan firma yok.</EmptyRow>}
          {items.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className={td}>
                <Link href={`/yonetim/firmalar/${c.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                  {c.displayName}
                </Link>
                <div className="text-xs text-slate-500">{c.legalName}</div>
              </td>
              <td className={`${td} font-mono text-xs`}>{c.taxNumber}</td>
              <td className={`${td} font-mono text-xs`}>{c.k3LicenseNumber ?? <span className="font-sans text-slate-400">Yok</span>}</td>
              <td className={td}>{c.cityName ?? c.cityCode}</td>
              <td className={td}>
                {c.owner.fullName}
                <div className="text-xs text-slate-500">{formatPhone(c.owner.phone)}</div>
              </td>
              <td className={td}>
                <VerificationBadge status={c.verificationStatus} />
              </td>
              <td className={`${td} whitespace-nowrap text-slate-600`}>{formatDate(c.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      <Pager page={page} limit={LIMIT} total={total} href={(p) => href(filter.value, p)} />
    </>
  );
}
