import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/card";
import { ReviewText } from "@/components/reviews/review-text";
import { ReviewToolbar, reviewFilters } from "@/components/reviews/review-toolbar";
import { Stars } from "@/components/reviews/stars";
import { getAdminContext, oneParam, pageParam } from "@/lib/admin";
import { apiFetch, type AdminReviews } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { RATING_LABELS, companyPath, formatRating } from "@/lib/reviews";
import { FilterTabs, PageHeader, Pager, query, td, th } from "../admin-bits";
import { ReviewModeration } from "./review-moderation";

export const metadata: Metadata = { title: "Değerlendirmeler" };

type Tab = { value: string; label: string; status?: "visible" | "hidden"; reply?: "answered" | "unanswered" };
const TABS: Tab[] = [
  { value: "tumu", label: "Tümü" },
  { value: "yayinda", label: "Yayında", status: "visible" },
  { value: "gizli", label: "Gizlenen", status: "hidden" },
  { value: "yanitsiz", label: "Yanıt bekleyen", reply: "unanswered" },
  { value: "yanitli", label: "Yanıtlanan", reply: "answered" },
];
const LIMIT = 25;

/** Dar ekranda tablo satırı karta dönüşür: her satır bir kutu, hücreler alt alta */
const cell = `${td} max-lg:block max-lg:border-0 max-lg:px-0 max-lg:py-1`;

/**
 * Müşteri yorumları. Yorumlar onaysız yayımlanır; kurallara uymayanı (hakaret, kişisel bilgi, reklam)
 * yönetici gerekçeyle gizler. Gizli yorum firma sayfasından ve puan ortalamasından çıkar.
 */
export default async function AdminReviewsPage({ searchParams }: PageProps<"/yonetim/degerlendirmeler">) {
  const { token } = await getAdminContext();
  const params = await searchParams;
  const q = oneParam(params.ara)?.trim().slice(0, 100) || undefined;
  const tab = TABS.find((t) => t.value === oneParam(params.durum)) ?? TABS[0];
  const { puan, sirala, sort } = reviewFilters({ puan: oneParam(params.puan), sirala: oneParam(params.sirala) });
  const page = pageParam(params.sayfa);
  const { items, total, stats } = await apiFetch<AdminReviews>(
    `/admin/reviews${query({ status: tab.status, reply: tab.reply, rating: puan, sort, q, page, limit: LIMIT })}`,
    { token },
  );
  const durum = (value: string) => (value === "tumu" ? undefined : value);
  const href = (tabValue: string, sayfa = 1) =>
    `/yonetim/degerlendirmeler${query({ durum: durum(tabValue), ara: q, puan, sirala, sayfa })}`;
  const tabCount: Record<string, number> = { tumu: stats.total, gizli: stats.hidden, yanitsiz: stats.unanswered };

  const kpis: { label: string; value: string; href?: string; stars?: number; highlight?: boolean }[] = [
    { label: "Toplam değerlendirme", value: String(stats.total), href: "/yonetim/degerlendirmeler" },
    { label: "Ortalama puan (yayında)", value: stats.total ? formatRating(stats.ratingAverage) : "–", stars: stats.ratingAverage },
    { label: "Son 7 günde gelen", value: String(stats.lastWeek) },
    {
      label: "Yayında 1-2 yıldız",
      value: String(stats.lowRating),
      href: "/yonetim/degerlendirmeler?durum=yayinda&sirala=dusuk",
      highlight: stats.lowRating > 0,
    },
    { label: "Firma yanıtı bekleyen", value: String(stats.unanswered), href: "/yonetim/degerlendirmeler?durum=yanitsiz" },
    { label: "Gizlenen", value: String(stats.hidden), href: "/yonetim/degerlendirmeler?durum=gizli" },
  ];

  return (
    <>
      <PageHeader
        title="Değerlendirmeler"
        description="Müşteri yorumları onaysız yayımlanır. Hakaret, kişisel bilgi ya da reklam içereni gerekçe yazarak gizle."
      />

      <ul className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Değerlendirme özeti">
        {kpis.map((k) => {
          const body = (
            <>
              <p className={`text-2xl font-bold tabular-nums ${k.highlight ? "text-accent-800" : "text-slate-900"}`}>{k.value}</p>
              {k.stars !== undefined && k.stars > 0 && <Stars value={k.stars} />}
              <p className="mt-1 text-sm text-slate-600">{k.label}</p>
            </>
          );
          const box = `block h-full rounded-xl border bg-white p-4 shadow-sm ${
            k.highlight ? "border-accent-300 ring-1 ring-accent-300" : "border-slate-200"
          }`;
          return (
            <li key={k.label}>
              {k.href ? (
                <Link href={k.href} className={`${box} hover:border-brand-300`}>
                  {body}
                </Link>
              ) : (
                <div className={box}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mb-4 space-y-3">
        <FilterTabs
          label="Değerlendirme süzgeci"
          current={tab.value}
          options={TABS.map((t) => ({
            value: t.value,
            label: t.value in tabCount ? `${t.label} (${tabCount[t.value]})` : t.label,
            href: href(t.value),
          }))}
        />
        <ReviewToolbar
          action="/yonetim/degerlendirmeler"
          q={q}
          rating={puan}
          sort={sirala}
          keep={{ durum: durum(tab.value) }}
          placeholder="Firma, müşteri adı veya yorum metni"
        />
      </div>

      <div className="relative rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm max-lg:block">
          <caption className="sr-only">Değerlendirmeler</caption>
          <thead className="max-lg:hidden">
            <tr>
              <th scope="col" className={`${th} w-32`}>Puan</th>
              <th scope="col" className={th}>Yorum</th>
              <th scope="col" className={`${th} w-44`}>Firma</th>
              <th scope="col" className={`${th} w-48`}>Müşteri ve iş</th>
              <th scope="col" className={`${th} w-36`}>Durum</th>
              <th scope="col" className={`${th} w-24`}>
                <span className="sr-only">İşlem</span>
              </th>
            </tr>
          </thead>
          <tbody className="max-lg:block max-lg:divide-y max-lg:divide-slate-200">
            {items.length === 0 && (
              <tr className="max-lg:block">
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500 max-lg:block">
                  Bu süzgece uyan değerlendirme yok.
                </td>
              </tr>
            )}
            {items.map((r) => (
              <tr key={r.id} className={`hover:bg-slate-50 max-lg:grid max-lg:grid-cols-[1fr_auto] max-lg:gap-x-3 max-lg:p-4 ${r.isPublished ? "" : "bg-amber-50/40"}`}>
                <td className={`${cell} whitespace-nowrap`}>
                  <Stars value={r.rating} />
                  <div className="mt-1 text-xs font-medium text-slate-700">{RATING_LABELS[r.rating]}</div>
                  <div className="text-xs text-slate-500">{formatDate(r.createdAt)}</div>
                </td>
                <td className={`${cell} max-lg:col-span-2 max-lg:row-start-2`}>
                  <ReviewText comment={r.comment} companyReply={r.companyReply} companyName={r.company.displayName} />
                </td>
                <td className={`${cell} max-lg:col-span-2`}>
                  <Link href={`/yonetim/firmalar/${r.company.id}`} className="inline-block py-0.5 font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                    {r.company.displayName}
                  </Link>
                  {r.isPublished && (
                    <div>
                      <Link href={`${companyPath(r.company)}#yorumlar`} className="inline-block py-1 text-xs font-medium text-brand-700 hover:underline">
                        Firma sayfasında gör
                      </Link>
                    </div>
                  )}
                </td>
                <td className={`${cell} max-lg:col-span-2`}>
                  <Link href={`/yonetim/kullanicilar/${r.customer.id}`} className="inline-block py-0.5 font-medium text-slate-900 hover:underline">
                    {r.customer.fullName}
                  </Link>
                  <div className="text-xs text-slate-500">
                    <Link href={`/yonetim/talepler/${r.requestId}`} className="hover:underline">
                      {r.route}
                    </Link>{" "}
                    · taşınma {formatDate(r.moveDate)}
                  </div>
                </td>
                <td className={`${cell} max-lg:col-span-2`}>
                  <div className="flex flex-wrap gap-1">
                    {r.isPublished ? <Badge tone="success">Yayında</Badge> : <Badge tone="warning">Gizli</Badge>}
                    {r.companyReply ? <Badge tone="brand">Yanıtlandı</Badge> : <Badge>Yanıt yok</Badge>}
                  </div>
                  {!r.isPublished && (
                    <p className="mt-1.5 text-xs text-slate-700">
                      {r.hiddenAt && <span className="block text-slate-500">{formatDateTime(r.hiddenAt)}</span>}
                      {r.hiddenReason && <>Gizleme gerekçesi: {r.hiddenReason}</>}
                    </p>
                  )}
                </td>
                <td className={`${cell} text-right max-lg:col-start-2 max-lg:row-start-1 max-lg:text-right`}>
                  <ReviewModeration
                    key={`${r.id}-${r.isPublished}`}
                    reviewId={r.id}
                    isPublished={r.isPublished}
                    label={`${r.company.displayName} · ${r.customer.fullName} · ${r.rating} yıldız`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} limit={LIMIT} total={total} href={(p) => href(tab.value, p)} />
    </>
  );
}
