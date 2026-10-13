import Link from "next/link";
import { CompanyLogo } from "@/components/company-logo";
import type { LatestReview } from "@/lib/api";
import { companyPath } from "@/lib/reviews";
import { Stars } from "./stars";
import { VerifiedMove } from "./verified-move";

/**
 * Gerçek taşımalardan son yorumlar (ana sayfa, il sayfaları). Her kart "doğrulanmış taşıma" rozeti,
 * taşınma ayı ve güzergâhla; firma adı firma sayfasına bağlanır. Puana göre süzülmez.
 */
export function LatestReviews({
  reviews,
  wide = true,
  className = "",
}: {
  reviews: LatestReview[];
  /** Geniş sayfada üç sütun; dar sayfada (il sayfası) alt alta */
  wide?: boolean;
  className?: string;
}) {
  if (reviews.length === 0) return null;
  return (
    <ul className={`grid gap-4 ${wide ? "md:grid-cols-3" : ""} ${className}`}>
      {reviews.map((r) => (
        <li key={r.id} className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Stars value={r.rating} />
            <span className="text-sm font-semibold text-zinc-900">{r.authorName}</span>
            {r.editedAt && <span className="text-xs text-zinc-600">düzenlendi</span>}
          </div>
          <VerifiedMove moveDate={r.moveDate} route={r.route} className="mt-2" />
          <blockquote className="mt-3 line-clamp-5 whitespace-pre-line text-zinc-900">{r.comment}</blockquote>
          <Link
            href={`${companyPath(r.company)}#yorumlar`}
            className="mt-auto flex items-center gap-2 pt-4 text-sm font-semibold text-brand-700 hover:underline"
          >
            <CompanyLogo name={r.company.displayName} logoUrl={r.company.logoUrl} size="sm" />
            <span className="min-w-0 truncate">{r.company.displayName}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
