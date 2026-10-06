import type { CompanyRequest, CompanyRequestView, OwnQuote } from "@/lib/api";
import { Badge } from "@/components/ui/card";
import { floorLabel, formatDate, formatMoney, place } from "@/lib/format";
import { routeText } from "@/lib/geo";
import { homeTypeLabel, turkeyDate } from "@/lib/request-options";

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

/** Asansörsüz bu kattan (dahil) yukarısı fiyatı belirgin etkiler: firmaya uyarı olarak gösterilir */
export const HEAVY_FLOOR = 2;
export const isHeavyFloor = (floor: number, elevator: boolean) => !elevator && floor >= HEAVY_FLOOR;

/** Taşınma gününe kalan gün (Türkiye saatiyle; bugün 0) */
export function daysUntil(iso: string, now = new Date()): number {
  const day = (d: Date) => Date.parse(turkeyDate(0, d));
  return Math.round((day(new Date(iso)) - day(now)) / 86_400_000);
}

export function daysText(days: number): string {
  if (days < 0) return "tarihi geçti";
  if (days === 0) return "bugün";
  if (days === 1) return "yarın";
  return `${days} gün sonra`;
}

/** Bu kadar gün (dahil) içindeki taşınma acil sayılır */
export const URGENT_DAYS = 3;

export type RequestFlag = { key: string; label: string; tone: "warning" | "accent" | "brand" | "neutral" };

/**
 * Talebin firmanın gözünden kaçmaması gereken yanları, önem sırasıyla: yakın tarih, asansörsüz katlar,
 * özel eşyalar, istenen ek hizmetler, şehirler arası, müşteri notu ve fotoğraflar.
 */
export function requestFlags(r: CompanyRequestView & { mediaCount?: number }, now = new Date()): RequestFlag[] {
  const flags: (RequestFlag | false)[] = [];
  const days = daysUntil(r.moveDate, now);
  if (days <= URGENT_DAYS) flags.push({ key: "acil", label: `Acil: ${daysText(days)}`, tone: "warning" });
  if (isHeavyFloor(r.fromFloor, r.fromHasElevator))
    flags.push({ key: "cikis-kat", label: `Çıkış: asansörsüz ${floorLabel(r.fromFloor)}`, tone: "warning" });
  if (isHeavyFloor(r.toFloor, r.toHasElevator))
    flags.push({ key: "varis-kat", label: `Varış: asansörsüz ${floorLabel(r.toFloor)}`, tone: "warning" });
  if (r.specialItems.length > 0) {
    const [first, ...rest] = r.specialItems;
    flags.push({ key: "ozel", label: `Özel eşya: ${first}${rest.length > 0 ? ` +${rest.length}` : ""}`, tone: "warning" });
  }
  for (const service of servicesOf(r)) flags.push({ key: service, label: service, tone: "accent" });
  if (r.fromCityCode !== r.toCityCode) flags.push({ key: "sehirlerarasi", label: "Şehirler arası", tone: "brand" });
  if (r.notes) flags.push({ key: "not", label: "Müşteri notu var", tone: "neutral" });
  if (r.mediaCount) flags.push({ key: "medya", label: `${r.mediaCount} fotoğraf/video`, tone: "neutral" });
  return flags.filter(Boolean) as RequestFlag[];
}

/** Talep listelerinde güzergâhın altındaki işaretler */
export function RequestFlags({ request, className = "" }: { request: CompanyRequest; className?: string }) {
  const flags = requestFlags(request);
  if (flags.length === 0) return null;
  return (
    <ul aria-label="Dikkat" className={`flex flex-wrap gap-1 ${className}`}>
      {flags.map((f) => (
        <li key={f.key}>
          <Badge tone={f.tone} className="whitespace-nowrap">
            {f.tone === "warning" && <span aria-hidden>!</span>}
            {f.label}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

const QUOTE_BADGE: Record<OwnQuote["status"], { label: string; tone: "brand" | "success" | "neutral" | "warning" }> = {
  PENDING: { label: "Teklifin bekliyor", tone: "brand" },
  ACCEPTED: { label: "Kabul edildi", tone: "success" },
  REJECTED: { label: "Başka firma seçildi", tone: "neutral" },
  WITHDRAWN: { label: "Geri çektin", tone: "neutral" },
  EXPIRED: { label: "Süresi doldu", tone: "neutral" },
};

/** hidePrice: tutar ayrı sütunda gösteriliyorsa */
export function QuoteBadge({ quote, hidePrice = false }: { quote: OwnQuote; hidePrice?: boolean }) {
  const b = QUOTE_BADGE[quote.status];
  return (
    <Badge tone={b.tone} className="whitespace-nowrap">
      {b.label}
      {!hidePrice && (quote.status === "PENDING" || quote.status === "ACCEPTED") ? ` · ${formatMoney(quote.priceTry)}` : ""}
    </Badge>
  );
}

/** Talep listesinde durum: teklif verildiyse teklifin durumu, verilmediyse "Yeni" */
export function RequestStateBadge({ request }: { request: Pick<CompanyRequest, "myQuote"> }) {
  return request.myQuote ? <QuoteBadge quote={request.myQuote} /> : <Badge tone="accent">Yeni</Badge>;
}
