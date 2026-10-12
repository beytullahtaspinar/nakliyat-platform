import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/card";
import { getAdminContext, oneParam, pageParam } from "@/lib/admin";
import { apiFetch, type AdminReport, type AdminReportList, type ReportReason, type ReportStatus, type ReportTarget } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { DataTable, EmptyRow, FilterTabs, PageHeader, Pager, ROLE_LABELS, query, td, th } from "../admin-bits";
import { ReportResolve } from "./report-resolve";

export const metadata: Metadata = { title: "Şikayetler" };

const FILTERS: { value: string; label: string; status: ReportStatus }[] = [
  { value: "acik", label: "Açık", status: "OPEN" },
  { value: "cozulen", label: "Haklı bulunan", status: "RESOLVED" },
  { value: "reddedilen", label: "Reddedilen", status: "DISMISSED" },
];
const TARGETS: Record<ReportTarget, string> = { MESSAGE: "Mesaj", REVIEW: "Yorum", REVIEW_REPLY: "Firma yanıtı" };
const REASONS: Record<ReportReason, string> = {
  SPAM: "İstenmeyen / reklam",
  ABUSE: "Hakaret ya da taciz",
  INAPPROPRIATE: "Uygunsuz içerik",
  FRAUD: "Dolandırıcılık şüphesi",
  OTHER: "Diğer",
};
const LIMIT = 25;

function Person({ person }: { person: AdminReport["reporter"] }) {
  if (!person) return <span className="text-slate-500">–</span>;
  return (
    <>
      <Link href={`/yonetim/kullanicilar/${person.id}`} className="font-medium text-slate-900 hover:underline">
        {person.name}
      </Link>
      <span className="block text-xs text-slate-500">
        {ROLE_LABELS[person.role]}
        {person.deleted && " · hesap silindi"}
      </span>
    </>
  );
}

/**
 * Uygulamalardan ve siteden bildirilen mesaj, yorum ve firma yanıtları. App Store ve Google Play kuralı gereği
 * şikayetler hızlı (24 saat içinde) incelenmeli: kural dışı içerik kaldırılır, gerekirse hesap silinir.
 */
export default async function AdminReportsPage({ searchParams }: PageProps<"/yonetim/sikayetler">) {
  const { token } = await getAdminContext();
  const params = await searchParams;
  const filter = FILTERS.find((f) => f.value === oneParam(params.durum)) ?? FILTERS[0];
  const page = pageParam(params.sayfa);
  const { items, total, counts } = await apiFetch<AdminReportList>(
    `/admin/reports${query({ status: filter.status, page, limit: LIMIT })}`,
    { token },
  );
  const href = (durum: string, sayfa = 1) => `/yonetim/sikayetler${query({ durum: durum === "acik" ? undefined : durum, sayfa })}`;
  const open = filter.status === "OPEN";

  return (
    <>
      <PageHeader
        title="Şikayetler"
        description="Kullanıcıların uygunsuz bulduğu mesajlar, yorumlar ve firma yanıtları. Mağaza kuralları gereği açık şikayetleri 24 saat içinde incele; kural dışı içeriği kaldır, gerekirse hesabı sil."
      />
      <div className="mb-4">
        <FilterTabs
          label="Şikayet durumu"
          current={filter.value}
          options={FILTERS.map((f) => ({
            value: f.value,
            label: f.status === "OPEN" ? `${f.label} (${counts.open})` : f.label,
            href: href(f.value),
          }))}
        />
      </div>

      <DataTable label={open ? "Açık şikayetler, en eski önce" : "Şikayetler"} minWidth={900}>
        <thead>
          <tr>
            <th scope="col" className={`${th} w-40`}>Tarih ve neden</th>
            <th scope="col" className={th}>Bildirilen içerik</th>
            <th scope="col" className={`${th} w-44`}>Yazan</th>
            <th scope="col" className={`${th} w-44`}>Bildiren</th>
            <th scope="col" className={`${th} w-28`}>
              <span className="sr-only">İşlem</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && <EmptyRow colSpan={5}>{open ? "Açık şikayet yok." : "Bu durumda şikayet yok."}</EmptyRow>}
          {items.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className={td}>
                <span className="block text-xs text-slate-500">{formatDateTime(r.createdAt)}</span>
                <span className="mt-1 block font-medium text-slate-900">{REASONS[r.reason]}</span>
              </td>
              <td className={td}>
                <Badge>{TARGETS[r.target]}</Badge>
                <p className="mt-1.5 text-sm whitespace-pre-line text-slate-900">{r.content}</p>
                {r.note && <p className="mt-1.5 text-xs text-slate-600">Bildirenin notu: {r.note}</p>}
                {r.requestId && (
                  <Link href={`/yonetim/talepler/${r.requestId}`} className="mt-1.5 inline-block text-xs font-medium text-brand-700 hover:underline">
                    İlgili talebi aç
                  </Link>
                )}
                {!open && (
                  <p className="mt-1.5 text-xs text-slate-600">
                    {r.resolvedAt && <span className="text-slate-500">{formatDateTime(r.resolvedAt)} · </span>}
                    {r.resolution || "Not yok"}
                  </p>
                )}
              </td>
              <td className={td}>
                <Person person={r.author} />
              </td>
              <td className={td}>
                <Person person={r.reporter} />
              </td>
              <td className={`${td} text-right`}>
                {open ? (
                  <ReportResolve reportId={r.id} target={r.target} label={`${TARGETS[r.target]} · ${REASONS[r.reason]} · ${r.author?.name ?? "?"}`} />
                ) : (
                  <Badge tone={r.status === "RESOLVED" ? "warning" : "neutral"}>{r.status === "RESOLVED" ? "Haklı" : "Reddedildi"}</Badge>
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
