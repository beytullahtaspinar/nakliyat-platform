import { formatRating } from "@/lib/reviews";

const STAR = "m12 3.8 2.5 5.1 5.6.8-4 4 1 5.5-5.1-2.7-5 2.7.9-5.5-4-4 5.6-.8L12 3.8Z";

/**
 * Puanı beş yıldızla gösterir; yarım yıldız kısmi dolguyla çizilir. Ekran okuyucu yalnızca
 * "5 üzerinden 4,5 puan" metnini okur.
 */
export function Stars({ value, className = "h-4 w-4" }: { value: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`5 üzerinden ${formatRating(value)} puan`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <span key={n} className={`relative inline-block ${className}`} aria-hidden>
            <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full text-zinc-300" fill="currentColor">
              <path d={STAR} />
            </svg>
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <svg viewBox="0 0 24 24" className={`h-full text-accent-600 ${className}`} fill="currentColor">
                  <path d={STAR} />
                </svg>
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
