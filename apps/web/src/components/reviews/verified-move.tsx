import { Badge } from "@/components/ui/card";
import { ShieldCheckIcon } from "@/components/ui/icons";
import { formatMonth } from "@/lib/format";

/** Rozetin açıklaması (üzerine gelince ve yorum bölümlerinin girişinde) */
export const VERIFIED_MOVE_HINT =
  "Bu yorumu, firmayla platform üzerinden anlaşan ve taşınması tamamlanan müşteri yazdı.";

/**
 * Yorumun gerçek bir taşımaya dayandığını gösteren rozet: "✓ Doğrulanmış taşıma · Ekim 2026 · İzmir → Ankara".
 * Her yorum platformda tamamlanan bir işe bağlı olduğu için tüm herkese açık yorumlarda görünür.
 */
export function VerifiedMove({ moveDate, route, className = "" }: { moveDate: string; route: string; className?: string }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-600 ${className}`}>
      <Badge tone="success" title={VERIFIED_MOVE_HINT}>
        <ShieldCheckIcon className="h-3.5 w-3.5" />
        Doğrulanmış taşıma
      </Badge>
      <span>
        {formatMonth(moveDate)} · {route}
      </span>
    </p>
  );
}
