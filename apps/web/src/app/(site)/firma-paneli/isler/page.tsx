import type { Metadata } from "next";
import { Badge, Card } from "@/components/ui/card";
import { apiFetch, type CompanyBooking, type Paginated } from "@/lib/api";
import { getCompanyContext } from "@/lib/company";
import { floorLabel, formatDate, formatMoney, formatPhone, place } from "@/lib/format";
import { homeTypeLabel } from "@/lib/request-options";
import { RouteOverview } from "@/components/map/route-overview";
import { routeText } from "@/lib/geo";

export const metadata: Metadata = { title: "İşlerim" };

const STATUS = {
  SCHEDULED: { label: "Planlandı", tone: "brand" },
  COMPLETED: { label: "Tamamlandı", tone: "success" },
  CANCELLED: { label: "İptal edildi", tone: "neutral" },
} as const;

type Stop = CompanyBooking["request"]["from"];
const stop = (s: Stop) =>
  `${s.address}, ${place(s.cityName, s.districtName)} · ${floorLabel(s.floor)}, ${s.hasElevator ? "asansörlü" : "asansörsüz"}`;
/** Yol tarifi için: işaret varsa koordinat, yoksa yazılı adres */
const directionsStop = (s: Stop) => ({
  location: s.location,
  text: [s.address, s.districtName, s.cityName].filter(Boolean).join(", "),
});

export default async function CompanyBookingsPage() {
  const { token, profile } = await getCompanyContext();
  if (!profile) return null;
  const { items } = await apiFetch<Paginated<CompanyBooking>>("/company/bookings?limit=50", { token });

  if (items.length === 0) {
    return (
      <p className="text-zinc-600 dark:text-zinc-400">
        Henüz kabul edilen teklifin yok. Bir müşteri teklifini kabul ettiğinde iş burada, müşterinin
        iletişim bilgileriyle birlikte görünür.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((b) => {
        const status = STATUS[b.status];
        return (
          <li key={b.id}>
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold">
                  {formatDate(b.scheduledAt)} · {homeTypeLabel(b.request.homeType)} · {formatMoney(b.priceTry)}
                </p>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <div>
                  <dt className="inline text-zinc-500">Müşteri: </dt>
                  <dd className="inline">
                    {b.customer.fullName} ·{" "}
                    <a href={`tel:${b.customer.phone}`} className="font-semibold text-brand-700 underline">
                      {formatPhone(b.customer.phone)}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="inline text-zinc-500">Çıkış: </dt>
                  <dd className="inline">{stop(b.request.from)}</dd>
                </div>
                <div>
                  <dt className="inline text-zinc-500">Varış: </dt>
                  <dd className="inline">{stop(b.request.to)}</dd>
                </div>
                {routeText(b.request) && (
                  <div>
                    <dt className="inline text-zinc-500">Yol: </dt>
                    <dd className="inline">{routeText(b.request)}</dd>
                  </div>
                )}
                {b.request.notes && (
                  <div>
                    <dt className="inline text-zinc-500">Not: </dt>
                    <dd className="inline">{b.request.notes}</dd>
                  </div>
                )}
              </dl>
              {b.status === "SCHEDULED" && (
                <div className="mt-4">
                  <RouteOverview from={directionsStop(b.request.from)} to={directionsStop(b.request.to)} />
                </div>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
