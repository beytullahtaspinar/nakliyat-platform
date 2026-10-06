import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/card";
import { getAdminContext, oneParam, pageParam } from "@/lib/admin";
import { apiFetch, type AdminNameChange, type Paginated, type VerificationStatus } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { DataTable, EmptyRow, FilterTabs, PageHeader, Pager, SearchForm, VERIFICATION, VerificationBadge, query, td, th } from "../admin-bits";
import { NameChangeReview } from "../name-change-review";

export const metadata: Metadata = { title: "Ad değişiklikleri" };

const FILTERS: { value: string; label: string; status?: VerificationStatus }[] = [
  { value: "bekleyen", label: "Onay bekleyen", status: "PENDING" },
  { value: "reddedilen", label: "Reddedilen", status: "REJECTED" },
  { value: "onayli", label: "Onaylı", status: "VERIFIED" },
  { value: "tumu", label: "Tümü" },
];
const LIMIT = 25;

/**
 * Onaylı firmaların görünen ad değişiklikleri. Onaylanana kadar eski ad yayında kalır; firma yılda en
 * fazla iki değişiklik yapabilir. Varsayılan liste onay bekleyenler (en eski önce).
 */
export default async function AdminNameChangesPage({ searchParams }: PageProps<"/yonetim/ad-degisiklikleri">) {
  const { token } = await getAdminContext();
  const params = await searchParams;
  const q = oneParam(params.ara)?.trim().slice(0, 100) || undefined;
  const filter = FILTERS.find((f) => f.value === oneParam(params.durum)) ?? (q ? FILTERS[3] : FILTERS[0]);
  const page = pageParam(params.sayfa);
  const { items, total } = await apiFetch<Paginated<AdminNameChange>>(
    `/admin/name-changes${query({ status: filter.status, q, page, limit: LIMIT })}`,
    { token },
  );
  const href = (durum: string, sayfa = 1) =>
    `/yonetim/ad-degisiklikleri${query({ durum: durum === "bekleyen" && !q ? undefined : durum, ara: q, sayfa })}`;

  return (
    <>
      <PageHeader
        title="Ad değişiklikleri"
        description="Onaylı firmaların görünen ad değişiklikleri. Onaylanana kadar eski ad yayında kalır; firma yılda en fazla iki kez ad değiştirebilir. Yeni adı ticari unvanla karşılaştırın."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label="Ad değişikliği durumu"
          current={filter.value}
          options={FILTERS.map((f) => ({ value: f.value, label: f.label, href: href(f.value) }))}
        />
        <SearchForm
          action="/yonetim/ad-degisiklikleri"
          q={q}
          placeholder="Firma adı, unvan veya vergi no"
          keep={{ durum: oneParam(params.durum) }}
        />
      </div>

      <DataTable label={filter.status === "PENDING" ? "Onay bekleyen ad değişiklikleri, en eski önce" : "Ad değişiklikleri"}>
        <thead>
          <tr>
            <th scope="col" className={th}>Firma</th>
            <th scope="col" className={th}>Değişiklik</th>
            <th scope="col" className={th}>İstendi</th>
            <th scope="col" className={th}>Karar</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <EmptyRow colSpan={4}>
              {filter.status === "PENDING" ? "Onay bekleyen ad değişikliği yok." : "Bu süzgece uyan ad değişikliği yok."}
            </EmptyRow>
          )}
          {items.map((c) => (
            <tr key={c.id} className="align-top hover:bg-slate-50">
              <td className={td}>
                <Link
                  href={`/yonetim/firmalar/${c.company.id}`}
                  className="font-semibold text-slate-900 hover:text-brand-700 hover:underline"
                >
                  {c.company.displayName}
                </Link>
                <div className="text-xs text-slate-600">{c.company.legalName}</div>
                <div className="mt-1">
                  <VerificationBadge status={c.company.verificationStatus} />
                </div>
              </td>
              <td className={td}>
                <div className="text-slate-600 line-through decoration-slate-400">{c.oldName}</div>
                <div className="font-semibold text-slate-900">{c.newName}</div>
              </td>
              <td className={`${td} whitespace-nowrap text-slate-600`}>{formatDate(c.createdAt)}</td>
              <td className={td}>
                {c.status === "PENDING" ? (
                  <NameChangeReview changeId={c.id} oldName={c.oldName} newName={c.newName} />
                ) : (
                  <>
                    <Badge tone={VERIFICATION[c.status].tone}>{c.status === "VERIFIED" ? "Onaylandı" : "Reddedildi"}</Badge>
                    {c.reviewedAt && <div className="mt-1 text-xs text-slate-600">{formatDate(c.reviewedAt)}</div>}
                    {c.reviewNote && <div className="mt-1 text-xs text-slate-600">Gerekçe: {c.reviewNote}</div>}
                  </>
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
