import type { Metadata } from "next";
import { PageHeader } from "@/components/panel/panel-bits";
import Link from "next/link";
import { BadgePill } from "@/components/company-badges";
import { Card } from "@/components/ui/card";
import { CheckIcon } from "@/components/ui/icons";
import { ReplyForm } from "@/components/reviews/reply-form";
import { ReviewCard } from "@/components/reviews/review-card";
import { RatingSummary } from "@/components/reviews/rating-summary";
import { apiFetch, type BadgeProgress, type CompanyReviews } from "@/lib/api";
import { BADGE_KEYS, BADGE_ORDER, badgeStatus } from "@/lib/badges";
import { getCompanyContext } from "@/lib/company";
import { formatDate } from "@/lib/format";
import { companyPath } from "@/lib/reviews";

export const metadata: Metadata = { title: "Değerlendirmeler" };

const LIMIT = 20;

/** Firmanın aldığı puan ve yorumlar; her yoruma bir kez yanıt verilebilir. */
export default async function CompanyReviewsPage({ searchParams }: PageProps<"/firma-paneli/degerlendirmeler">) {
  const { token, profile } = await getCompanyContext();
  if (!profile) return null;
  const sayfa = Number((await searchParams).sayfa);
  const page = Number.isInteger(sayfa) && sayfa > 0 ? sayfa : 1;
  const [{ items, total, summary }, badges] = await Promise.all([
    apiFetch<CompanyReviews>(`/company/reviews?page=${page}&limit=${LIMIT}`, { token }),
    apiFetch<BadgeProgress>("/company/profile/badges", { token }).catch(() => null),
  ]);
  const verified = profile.verificationStatus === "VERIFIED";

  return (
    <div>
      <PageHeader title="Değerlendirmeler" description="Müşterilerinin puanları ve yorumları. Her yoruma bir kez yanıt verebilirsin." />
      <Card className="p-5">
        <RatingSummary average={summary.ratingAverage} count={summary.ratingCount} distribution={summary.distribution} />
        <p className="mt-4 text-sm text-zinc-600">
          Müşterin, iş tamamlandı olarak işaretlendikten sonra firmanı 1-5 yıldızla değerlendirebilir. Taşıma günü
          geldiğinde İşlerim sayfasından işi tamamlaman müşteriye değerlendirme hatırlatması gönderir.
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

      {badges && <BadgeCard progress={badges} />}

      {items.length === 0 ? (
        <p className="mt-6 text-zinc-600">Henüz değerlendirme almadın.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((r) => (
            <ReviewCard
              key={r.id}
              as="li"
              review={r}
              companyName={profile.displayName}
              author={
                <>
                  {r.customerName} · {r.route} · taşınma {formatDate(r.moveDate)} ·{" "}
                  <Link href={`/firma-paneli/isler/${r.bookingId}`} className="text-brand-700 underline">
                    İşe git
                  </Link>
                </>
              }
            >
              {!r.isPublished && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Bu yorum yönetim tarafından yayından kaldırıldı ve puan ortalamana girmiyor.
                  {r.hiddenReason && ` Gerekçe: ${r.hiddenReason}`}
                </p>
              )}
              {!r.companyReply && <ReplyForm reviewId={r.id} />}
            </ReviewCard>
          ))}
        </ul>
      )}

      {total > LIMIT && (
        <nav aria-label="Sayfalar" className="mt-6 flex justify-between text-sm">
          {page > 1 ? (
            <Link href={`/firma-paneli/degerlendirmeler?sayfa=${page - 1}`} className="font-semibold text-brand-700 underline">
              ← Daha yeni
            </Link>
          ) : (
            <span />
          )}
          {page * LIMIT < total && (
            <Link href={`/firma-paneli/degerlendirmeler?sayfa=${page + 1}`} className="font-semibold text-brand-700 underline">
              Daha eski →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

/** Rozetler: kazanılanlar ve diğerleri için ne eksik */
function BadgeCard({ progress }: { progress: BadgeProgress }) {
  return (
    <Card id="rozetler" className="mt-6 scroll-mt-20 p-5">
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
