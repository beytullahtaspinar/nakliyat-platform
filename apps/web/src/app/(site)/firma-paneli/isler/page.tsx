import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card } from "@/components/ui/card";
import { apiFetch, type CompanyBooking, type Paginated, type UnreadMessages } from "@/lib/api";
import { getCompanyContext } from "@/lib/company";
import { floorLabel, formatDate, formatMoney, formatPhone, place } from "@/lib/format";
import { homeTypeLabel } from "@/lib/request-options";
import { RouteOverview } from "@/components/map/route-overview";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { Stars } from "@/components/reviews/stars";
import { completeBooking } from "@/lib/actions/reviews";
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
  const [{ items }, unread] = await Promise.all([
    apiFetch<Paginated<CompanyBooking>>("/company/bookings?limit=50", { token }),
    apiFetch<UnreadMessages>("/messages/unread", { token }),
  ]);
  const unreadFor = (bookingId: string) => unread.items.find((u) => u.bookingId === bookingId)?.count ?? 0;

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
              <p className="mt-4 text-sm">
                <Link href={`/firma-paneli/isler/${b.id}`} className="font-semibold text-brand-700 underline">
                  Müşteriyle mesajlaş
                </Link>
                {unreadFor(b.id) > 0 && (
                  <Badge tone="accent" className="ml-2">
                    {unreadFor(b.id)} yeni mesaj
                  </Badge>
                )}
              </p>
              {b.review && (
                <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-zinc-500">Müşterinin değerlendirmesi:</span>
                  <Stars value={b.review.rating} />
                  <Link href={`/firma-paneli/isler/${b.id}#degerlendirme`} className="font-semibold text-brand-700 underline">
                    {b.review.companyReply ? "Yorumu gör" : "Yorumu gör ve yanıtla"}
                  </Link>
                </p>
              )}
              {b.canComplete && (
                <div className="mt-4">
                  <ConfirmButton
                    action={completeBooking.bind(null, b.id, "/firma-paneli/isler")}
                    label="İş tamamlandı"
                    confirmText={`${b.customer.fullName} müşterisinin taşıması bitti mi? Onaylarsan iş tamamlandı olarak kapanır ve müşteriden firmanı değerlendirmesi istenir.`}
                    confirmLabel="Evet, tamamlandı"
                    variant="quiet"
                  />
                </div>
              )}
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
