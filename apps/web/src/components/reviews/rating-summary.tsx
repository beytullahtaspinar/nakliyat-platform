import Link from "next/link";
import type { RatingDistribution } from "@/lib/api";
import { formatRating } from "@/lib/reviews";
import { Stars } from "./stars";

/**
 * Ortalama puan, yorum sayısı ve 5'ten 1'e yıldız dağılımı çubukları. starHref verilirse her çubuk
 * o puandaki yorumlara süzen bağlantıdır (firma paneli).
 */
export function RatingSummary({
  average,
  count,
  distribution,
  headingLevel = 2,
  starHref,
}: {
  average: string | number;
  count: number;
  distribution: RatingDistribution;
  headingLevel?: 2 | 3;
  starHref?: (star: number) => string;
}) {
  const Heading = `h${headingLevel}` as const;
  if (count === 0) {
    return (
      <div>
        <Heading className="text-lg font-semibold">Puan ve yorumlar</Heading>
        <p className="mt-1 text-zinc-600">Henüz değerlendirme yok.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
      <div>
        <Heading className="sr-only">Puan özeti</Heading>
        <p className="text-4xl font-bold text-zinc-900">{formatRating(average)}</p>
        <Stars value={Number(average)} className="h-5 w-5" />
        <p className="mt-1 text-sm text-zinc-600">{count} değerlendirme</p>
      </div>
      <ul className="space-y-1.5 text-sm" aria-label="Yıldız dağılımı">
        {(["5", "4", "3", "2", "1"] as const).map((star) => {
          const n = distribution[star];
          return (
            <li key={star}>
              <Row
                href={starHref?.(Number(star))}
                className="flex items-center gap-2 rounded-md"
              >
                <span className="w-14 shrink-0 text-zinc-700">{star} yıldız</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200" aria-hidden>
                  <span className="block h-full rounded-full bg-accent-600" style={{ width: `${(n / count) * 100}%` }} />
                </span>
                <span className="w-8 shrink-0 text-right text-zinc-700">{n}</span>
              </Row>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Row({ href, className, children }: { href?: string; className: string; children: React.ReactNode }) {
  return href ? (
    <Link href={href} className={`${className} hover:bg-zinc-50`}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}
