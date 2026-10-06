import type { Metadata } from "next";
import { PageHeader } from "@/components/panel/panel-bits";
import Link from "next/link";
import { BadgePill } from "@/components/company-badges";
import { Badge, Card } from "@/components/ui/card";
import { CheckIcon } from "@/components/ui/icons";
import { ReplyForm } from "@/components/reviews/reply-form";
import { ReviewToolbar, reviewFilters } from "@/components/reviews/review-toolbar";
import { RatingSummary } from "@/components/reviews/rating-summary";
import { Stars } from "@/components/reviews/stars";
import { FilterTabs, Pager, query } from "@/app/yonetim/admin-bits";
import { oneParam, pageParam } from "@/lib/admin";
import { apiFetch, type BadgeProgress, type CompanyReviews } from "@/lib/api";
import { BADGE_KEYS, BADGE_ORDER, badgeStatus } from "@/lib/badges";
import { getCompanyContext } from "@/lib/company";
import { formatDate } from "@/lib/format";
import { RATING_LABELS, companyPath } from "@/lib/reviews";

export const metadata: Metadata = { title: "Değerlendirmeler" };

type Tab = { value: string; label: string; status?: "visible" | "hidden"; reply?: "answered" | "unanswered" };
const TABS: Tab[] = [
  { value: "tumu", label: "Tümü" },
  { value: "yanitsiz", label: "Yanıt bekleyen", reply: "unanswered" },
  { value: "yanitli", label: "Yanıtlanan", reply: "answered" },
  { value: "gizli", label: "Yayından kaldırılan", status: "hidden" },
];
const LIMIT = 20;
const PATH = "/firma-paneli/degerlendirmeler";

/**
 * Firmanın aldığı puan ve yorumlar: özet kutuları, puan dağılımı, sekme/puan/sıralama süzgeci ve
 * her yoruma bir kez yanıt. Yönetimin değerlendirmeler ekranıyla aynı düzen.
 */
export default async function CompanyReviewsPage({ searchParams }: PageProps<"/firma-paneli/degerlendirmeler">) {
  const { token, profile } = await getCompanyContext();
  if (!profile) return null;
  const params = await searchParams;
  const q = oneParam(params.ara)?.trim().slice(0, 100) || undefined;
  const tab = TABS.find((t) => t.value === oneParam(params.durum)) ?? TABS[0];
  const { puan, sirala, sort } = reviewFilters({ puan: oneParam(params.puan), sirala: oneParam(params.sirala) });
  const page = pageParam(params.sayfa);
  const [{ items, total, summary }, badges] = await Promise.all([
    apiFetch<CompanyReviews>(
      `/company/reviews${query({ status: tab.status, reply: tab.reply, rating: puan, sort, q, page, limit: LIMIT })}`,
      { token },
    ),
    apiFetch<BadgeProgress>("/company/profile/badges", { token }).catch(() => null),
  ]);
  const verified = profile.verificationStatus === "VERIFIED";
  const { counts } = summary;
  const durum = (value: string) => (value === "tumu" ? undefined : value);
  const href = (tabValue: string, sayfa = 1) => `${PATH}${query({ durum: durum(tabValue), ara: q, puan, sirala, sayfa })}`;
  const tabCount: Record<string, number> = { tumu: counts.total, yanitsiz: counts.unanswered, gizli: counts.hidden };
  const replyRate = counts.total ? Math.round(((counts.total - counts.unanswered) / counts.total) * 100) : null;

  const kpis = [
    { label: "Toplam değerlendirme", value: String(counts.total), href: PATH },
    {
      label: "Yanıt bekleyen",
      value: String(counts.unanswered),
      href: `${PATH}?durum=yanitsiz`,
      highlight: counts.unanswered > 0,
    },
    { label: "Yanıt oranı", value: replyRate === null ? "–" : `%${replyRate}` },
    { label: "Yayından kaldırılan", value: String(counts.hidden), href: `${PATH}?durum=gizli` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Değerlendirmeler" description="Müşterilerinin puanları ve yorumları. Her yoruma bir kez yanıt verebilirsin." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="p-5">
          <RatingSummary
            average={summary.ratingAverage}
            count={summary.ratingCount}
            distribution={summary.distribution}
            starHref={(star) => `${PATH}${query({ durum: durum(tab.value), puan: star })}`}
          />
          <p className="mt-4 text-sm text-zinc-600">
            Taşıma günü geldiğinde İşlerim sayfasından işi tamamlaman müşteriye değerlendirme hatırlatması gönderir.
            {verified && (
              <>
                {" "}
                <Link href={companyPath(profile)} className="font-semibold text-brand-700 underline">
                  Firma sayfanı gör
                </Link>
              </>
            )}
          </p>
        </Card>
        <ul className="grid grid-cols-2 gap-3" aria-label="Değerlendirme sayaçları">
          {kpis.map((k) => {
            const body = (
              <>
                <p className={`text-2xl font-bold tabular-nums ${k.highlight ? "text-accent-800" : "text-zinc-900"}`}>{k.value}</p>
                <p className="mt-1 text-sm text-zinc-600">{k.label}</p>
              </>
            );
            const box = `block h-full rounded-xl border bg-white p-4 shadow-sm ${
              k.highlight ? "border-accent-300 ring-1 ring-accent-300" : "border-zinc-200"
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
      </div>

      <section aria-labelledby="yorumlar-baslik" className="space-y-3">
        <h2 id="yorumlar-baslik" className="text-lg font-semibold text-zinc-900">
          Yorumlar
        </h2>
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
          action={PATH}
          q={q}
          rating={puan}
          sort={sirala}
          keep={{ durum: durum(tab.value) }}
          placeholder="Müşteri adı veya yorum metni"
        />

        {items.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white px-4 py-10 text-center text-zinc-600">
            {counts.total === 0 ? "Henüz değerlendirme almadın." : "Bu süzgece uyan değerlendirme yok."}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            {items.map((r) => (
              <li key={r.id} className={`p-4 sm:p-5 ${r.isPublished ? "" : "bg-amber-50/50"}`}>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars value={r.rating} />
                    <span className="text-sm font-semibold text-zinc-900">{RATING_LABELS[r.rating]}</span>
                    <span className="text-sm text-zinc-600">{formatDate(r.createdAt)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {!r.isPublished && <Badge tone="warning">Yayından kaldırıldı</Badge>}
                    {r.companyReply ? <Badge tone="brand">Yanıtlandı</Badge> : <Badge tone="accent">Yanıt bekliyor</Badge>}
                  </div>
                </div>
                <p className="mt-1 text-sm text-zinc-700">
                  <span className="font-medium text-zinc-900">{r.customerName}</span> · {r.route} · taşınma{" "}
                  {formatDate(r.moveDate)} ·{" "}
                  <Link href={`/firma-paneli/isler/${r.bookingId}`} className="text-brand-700 underline">
                    İşe git
                  </Link>
                </p>
                {r.comment ? (
                  <p className="mt-2 whitespace-pre-line text-zinc-900">{r.comment}</p>
                ) : (
                  <p className="mt-2 text-sm text-zinc-600">Yorum yazılmadan puan verildi.</p>
                )}
                {!r.isPublished && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Bu yorum yönetim tarafından yayından kaldırıldı ve puan ortalamana girmiyor.
                    {r.hiddenReason && ` Gerekçe: ${r.hiddenReason}`}
                  </p>
                )}
                {r.companyReply ? (
                  <div className="mt-3 rounded-lg border-l-4 border-brand-600 bg-brand-50 px-3 py-2">
                    <p className="text-sm font-semibold text-brand-900">
                      {profile.displayName} yanıtı
                      {r.companyReplyAt && <span className="font-normal text-zinc-700"> · {formatDate(r.companyReplyAt)}</span>}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm text-zinc-900">{r.companyReply}</p>
                  </div>
                ) : (
                  <ReplyForm reviewId={r.id} />
                )}
              </li>
            ))}
          </ul>
        )}
        <Pager page={page} limit={LIMIT} total={total} href={(p) => href(tab.value, p)} />
      </section>

      {badges && <BadgeCard progress={badges} />}
    </div>
  );
}

/** Rozetler: kazanılanlar ve diğerleri için ne eksik */
function BadgeCard({ progress }: { progress: BadgeProgress }) {
  return (
    <Card id="rozetler" className="scroll-mt-20 p-5">
      <h2 className="text-lg font-semibold">Rozetlerin</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Rozetler müşterinin teklif listesinde ve firma sayfanda görünür. Güncel verilerden hesaplanır; koşul
        sağlanmazsa rozet kalkar.
      </p>
      <ul className="mt-4 space-y-4">
        {BADGE_ORDER.map((code) => {
          const earned = progress[BADGE_KEYS[code]].earned;
          return (
            <li key={code} className="flex gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  earned ? "bg-brand-700 text-white" : "border border-zinc-300"
                }`}
              >
                {earned && <CheckIcon className="h-3.5 w-3.5" />}
                <span className="sr-only">{earned ? "Kazanıldı" : "Henüz kazanılmadı"}</span>
              </span>
              <div>
                <BadgePill code={code} />
                <p className="mt-1 text-sm text-zinc-800">{badgeStatus(code, progress)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
