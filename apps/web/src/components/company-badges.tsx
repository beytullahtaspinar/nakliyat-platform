import { Badge } from "@/components/ui/card";
import { BoltIcon, ShieldCheckIcon, StarIcon } from "@/components/ui/icons";
import type { BadgeCode } from "@/lib/api";
import { BADGE_ORDER, BADGES } from "@/lib/badges";

const ICONS: Record<BadgeCode, typeof StarIcon> = {
  DOCUMENTS_VERIFIED: ShieldCheckIcon,
  FAST_RESPONSE: BoltIcon,
  TOP_RATED: StarIcon,
};

const TONES = { DOCUMENTS_VERIFIED: "brand", FAST_RESPONSE: "accent", TOP_RATED: "accent" } as const;

export function BadgePill({ code }: { code: BadgeCode }) {
  const Icon = ICONS[code];
  return (
    <Badge tone={TONES[code]} title={BADGES[code].description}>
      <Icon className="h-3.5 w-3.5" />
      {BADGES[code].label}
    </Badge>
  );
}

/** Firmanın kazandığı rozetler, sabit sırayla. Rozet yoksa hiçbir şey çizilmez. */
export function CompanyBadges({ badges, className = "" }: { badges?: BadgeCode[]; className?: string }) {
  const earned = BADGE_ORDER.filter((code) => badges?.includes(code));
  if (earned.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Firma rozetleri">
      {earned.map((code) => (
        <li key={code}>
          <BadgePill code={code} />
        </li>
      ))}
    </ul>
  );
}

/** Rozetlerin anlamı (teklif listesinin altında açılır kutu) */
export function BadgeLegend() {
  return (
    <details className="mt-4 text-sm text-zinc-600">
      <summary className="cursor-pointer font-medium text-brand-700">Rozetler ne anlama geliyor?</summary>
      <dl className="mt-3 space-y-2">
        {BADGE_ORDER.map((code) => (
          <div key={code}>
            <dt>
              <BadgePill code={code} />
            </dt>
            <dd className="mt-1">{BADGES[code].description}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
