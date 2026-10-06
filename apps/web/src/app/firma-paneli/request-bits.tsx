import type { CompanyRequestView, OwnQuote } from "@/lib/api";
import { Badge } from "@/components/ui/card";
import { floorLabel, formatDate, formatMoney, place } from "@/lib/format";
import { routeText } from "@/lib/geo";
import { homeTypeLabel } from "@/lib/request-options";

export const route = (r: Pick<CompanyRequestView, "fromCityName" | "fromDistrictName" | "toCityName" | "toDistrictName">) =>
  `${place(r.fromCityName, r.fromDistrictName)} → ${place(r.toCityName, r.toDistrictName)}`;

export function requestFacts(r: CompanyRequestView): string {
  return [
    homeTypeLabel(r.homeType),
    `${formatDate(r.moveDate)}${r.isDateFlexible ? " (esnek)" : ""}`,
    routeText(r) ?? (r.distanceKm ? `${r.distanceKm} km` : "Şehir içi"),
    r.estimatedVolumeM3 ? `~${r.estimatedVolumeM3} m³` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function servicesOf(r: Pick<CompanyRequestView, "needsPacking" | "needsAssembly" | "needsStorage">): string[] {
  return [r.needsPacking && "Paketleme", r.needsAssembly && "Söküm/kurulum", r.needsStorage && "Depolama"].filter(
    Boolean,
  ) as string[];
}

export const floorText = (floor: number, elevator: boolean) =>
  `${floorLabel(floor)}, ${elevator ? "asansörlü" : "asansörsüz"}`;

const QUOTE_BADGE: Record<OwnQuote["status"], { label: string; tone: "brand" | "success" | "neutral" | "warning" }> = {
  PENDING: { label: "Teklifin bekliyor", tone: "brand" },
  ACCEPTED: { label: "Kabul edildi", tone: "success" },
  REJECTED: { label: "Başka firma seçildi", tone: "neutral" },
  WITHDRAWN: { label: "Geri çektin", tone: "neutral" },
  EXPIRED: { label: "Süresi doldu", tone: "neutral" },
};

export function QuoteBadge({ quote }: { quote: OwnQuote }) {
  const b = QUOTE_BADGE[quote.status];
  return (
    <Badge tone={b.tone}>
      {b.label}
      {quote.status === "PENDING" || quote.status === "ACCEPTED" ? ` · ${formatMoney(quote.priceTry)}` : ""}
    </Badge>
  );
}
