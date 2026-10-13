import Link from "next/link";
import type { ReviewExcerpt as Excerpt } from "@/lib/api";
import { formatMonth } from "@/lib/format";
import { Stars } from "./stars";
import { VERIFIED_MOVE_HINT } from "./verified-move";

/**
 * Teklif kartında firmanın en yeni yorumundan alıntı: müşteri fiyatı görürken firmayla taşınan birinin
 * sözünü de görür. Puana göre seçilmez (iyi ya da kötü, en güncel yorum).
 */
export function ReviewExcerpt({ review, href, total }: { review: Excerpt; href: string; total: number }) {
  return (
    <figure className="mt-4 rounded-lg border-l-4 border-accent-500 bg-accent-50/60 px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Stars value={review.rating} />
        <span className="text-xs font-semibold text-green-800" title={VERIFIED_MOVE_HINT}>
          ✓ Doğrulanmış taşıma
        </span>
      </div>
      <blockquote className="mt-1 text-zinc-900">&ldquo;{review.excerpt}&rdquo;</blockquote>
      <figcaption className="mt-1 text-xs text-zinc-600">
        {review.authorName} · {review.route} · {formatMonth(review.moveDate)}
        {" · "}
        <Link href={href} className="font-semibold text-brand-700 underline">
          {total > 1 ? `Tüm yorumlar (${total})` : "Firma sayfası"}
        </Link>
      </figcaption>
    </figure>
  );
}
