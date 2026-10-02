import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/card";
import { getAdminContext, oneParam, pageParam } from "@/lib/admin";
import { apiFetch, type AdminDocument, type Paginated, type VerificationStatus } from "@/lib/api";
import { DOCUMENT_LABELS, REQUIREMENT_STATES, documentState, formatDay } from "@/lib/company-documents";
import { formatDate } from "@/lib/format";
import { DataTable, EmptyRow, FilterTabs, PageHeader, Pager, SearchForm, VerificationBadge, query, td, th } from "../admin-bits";

export const metadata: Metadata = { title: "Belgeler" };

const FILTERS: { value: string; label: string; status?: VerificationStatus }[] = [
  { value: "bekleyen", label: "Onay bekleyen", status: "PENDING" },
  { value: "reddedilen", label: "Reddedilen", status: "REJECTED" },
  { value: "onayli", label: "Onaylı", status: "VERIFIED" },
  { value: "tumu", label: "Tümü" },
];
const LIMIT = 25;

/**
 * Firmaların yüklediği belgeler. Varsayılan liste onay bekleyenler (en eski önce): yeni başvurular ve
 * onaylı firmaların sonradan eklediği ya da yenilediği belgeler. Karar firma inceleme ekranında verilir.
 */
export default async function AdminDocumentsPage({ searchParams }: PageProps<"/yonetim/belgeler">) {
  const { token } = await getAdminContext();
  const params = await searchParams;
  const q = oneParam(params.ara)?.trim().slice(0, 100) || undefined;
  const filter = FILTERS.find((f) => f.value === oneParam(params.durum)) ?? (q ? FILTERS[3] : FILTERS[0]);
  const page = pageParam(params.sayfa);
  const { items, total } = await apiFetch<Paginated<AdminDocument>>(
    `/admin/documents${query({ status: filter.status, q, page, limit: LIMIT })}`,
    { token },
  );
  const href = (durum: string, sayfa = 1) =>
    `/yonetim/belgeler${query({ durum: durum === "bekleyen" && !q ? undefined : durum, ara: q, sayfa })}`;

  return (
    <>
      <PageHeader
        title="Belgeler"
        description="Firmaların yüklediği belgeler. Onaylı firmaların yeni eklediği ya da yenilediği belgeler de burada onay bekler."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label="Belge durumu"
          current={filter.value}
          options={FILTERS.map((f) => ({ value: f.value, label: f.label, href: href(f.value) }))}
        />
        <SearchForm
          action="/yonetim/belgeler"
          q={q}
          placeholder="Firma adı, unvan veya vergi no"
          keep={{ durum: oneParam(params.durum) }}
        />
      </div>

      <DataTable label={filter.status === "PENDING" ? "Onay bekleyen belgeler, en eski önce" : "Belgeler"}>
        <thead>
          <tr>
            <th scope="col" className={th}>Firma</th>
            <th scope="col" className={th}>Belge</th>
            <th scope="col" className={th}>Durum</th>
            <th scope="col" className={th}>Yüklendi</th>
            <th scope="col" className={th}>
              <span className="sr-only">İşlem</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <EmptyRow colSpan={5}>
              {filter.status === "PENDING" ? "Onay bekleyen belge yok." : "Bu süzgece uyan belge yok."}
            </EmptyRow>
          )}
          {items.map((d) => {
            const state = REQUIREMENT_STATES[documentState(d)];
            return (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className={td}>
                  <Link
                    href={`/yonetim/firmalar/${d.company.id}`}
                    className="font-semibold text-slate-900 hover:text-brand-700 hover:underline"
                  >
                    {d.company.displayName}
                  </Link>
                  <div className="mt-1">
                    <VerificationBadge status={d.company.verificationStatus} />
                  </div>
                </td>
                <td className={td}>
                  <div className="font-medium text-slate-900">{DOCUMENT_LABELS[d.type]}</div>
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-xs text-brand-700 hover:underline"
                  >
                    {d.fileName}
                  </a>
                  {d.validUntil && <div className="text-xs text-slate-500">Geçerlilik: {formatDay(d.validUntil)}</div>}
                </td>
                <td className={td}>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={state.tone}>{state.label}</Badge>
                    {d.status === "PENDING" && (
                      <Badge tone={d.replacesVerified ? "brand" : "neutral"}>
                        {d.replacesVerified ? "Güncelleme" : "Yeni belge"}
                      </Badge>
                    )}
                  </div>
                  {d.reviewNote && <div className="mt-1 text-xs text-slate-600">Gerekçe: {d.reviewNote}</div>}
                </td>
                <td className={`${td} whitespace-nowrap text-slate-600`}>{formatDate(d.createdAt)}</td>
                <td className={td}>
                  <Link
                    href={`/yonetim/firmalar/${d.company.id}`}
                    className="whitespace-nowrap font-semibold text-brand-700 hover:underline"
                    aria-label={`${d.company.displayName} firmasını incele`}
                  >
                    İncele
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
      <Pager page={page} limit={LIMIT} total={total} href={(p) => href(filter.value, p)} />
    </>
  );
}
