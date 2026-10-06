import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CancelBookingForm } from "@/components/bookings/cancel-booking-form";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { RouteOverview } from "@/components/map/route-overview";
import { Conversation } from "@/components/messages/conversation";
import { PageHeader, PanelSection } from "@/components/panel/panel-bits";
import { ReplyForm } from "@/components/reviews/reply-form";
import { ReviewCard } from "@/components/reviews/review-card";
import { completeBooking } from "@/lib/actions/reviews";
import { ApiError, apiFetch, type CompanyBooking, type Conversation as ConversationData } from "@/lib/api";
import { getCompanyContext } from "@/lib/company";
import { floorLabel, formatDate, formatMoney, formatPhone, place } from "@/lib/format";
import { routeText } from "@/lib/geo";
import { homeTypeLabel } from "@/lib/request-options";
import { BookingStatusBadge, bookingRoute } from "../../booking-bits";

export const metadata: Metadata = { title: "İş ayrıntısı" };

type Stop = CompanyBooking["request"]["from"];
const directionsStop = (s: Stop) => ({
  location: s.location,
  text: [s.address, s.districtName, s.cityName].filter(Boolean).join(", "),
});

/** İş kaydı: müşteriyle mesajlar ve değerlendirme solda, iş bilgileri ve işlemler sağda */
export default async function CompanyBookingPage({ params }: PageProps<"/firma-paneli/isler/[id]">) {
  const { id } = await params;
  const { token, profile } = await getCompanyContext();
  if (!profile) return null;

  let booking: CompanyBooking;
  let conversation: ConversationData;
  try {
    [booking, conversation] = await Promise.all([
      apiFetch<CompanyBooking>(`/company/bookings/${encodeURIComponent(id)}`, { token }),
      apiFetch<ConversationData>(`/bookings/${encodeURIComponent(id)}/messages`, { token }),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const { request: r, customer } = booking;
  const stop = (s: Stop) => (
    <>
      {s.address}
      <span className="block text-slate-500">
        {place(s.cityName, s.districtName)} · {floorLabel(s.floor)}, {s.hasElevator ? "asansörlü" : "asansörsüz"}
      </span>
    </>
  );
  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-900">{value}</dd>
    </div>
  );

  return (
    <>
      <PageHeader
        back={{ href: "/firma-paneli/isler", label: "İşlerim" }}
        title={`${customer.fullName} · ${formatDate(booking.scheduledAt)}`}
        description={bookingRoute(r.from, r.to)}
        actions={<BookingStatusBadge status={booking.status} />}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          {booking.status === "CANCELLED" && (
            <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800">
              Bu iş iptal edildi{booking.cancelledAt && ` (${formatDate(booking.cancelledAt)})`}.
              {booking.cancelReason && ` İptal nedeni: ${booking.cancelReason}`}
            </p>
          )}
          {booking.status === "COMPLETED" && (
            <PanelSection
              id="degerlendirme"
              title="Müşterinin değerlendirmesi"
              description={
                booking.review
                  ? undefined
                  : "İş tamamlandı. Müşteri henüz değerlendirme yapmadı; yaptığında burada ve Değerlendirmeler sayfasında görünür."
              }
            >
              {booking.review && (
                <ReviewCard review={booking.review} companyName={profile.displayName}>
                  {!booking.review.isPublished && (
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      Bu yorum yönetim tarafından yayından kaldırıldı ve puan ortalamana girmiyor.
                      {booking.review.hiddenReason && ` Gerekçe: ${booking.review.hiddenReason}`}
                    </p>
                  )}
                  {!booking.review.companyReply && <ReplyForm reviewId={booking.review.id} />}
                </ReviewCard>
              )}
            </PanelSection>
          )}
          <PanelSection id="mesajlar" title={`${conversation.counterpart} ile mesajlar`}>
            <Conversation initial={conversation} refreshBadges />
          </PanelSection>
        </div>

        <aside className="space-y-6">
          <PanelSection id="is-bilgileri" title="İş bilgileri">
            <dl className="-my-2 divide-y divide-slate-100 text-sm">
              {row("Müşteri", customer.fullName)}
              {row(
                "Telefon",
                <a href={`tel:${customer.phone}`} className="font-semibold text-brand-700 underline">
                  {formatPhone(customer.phone)}
                </a>,
              )}
              {row("Taşınma", formatDate(booking.scheduledAt))}
              {row("Tutar", <span className="font-semibold">{formatMoney(booking.priceTry)}</span>)}
              {row("Ev", homeTypeLabel(r.homeType))}
              {routeText(r) && row("Yol", routeText(r))}
              {r.notes && row("Not", r.notes)}
            </dl>
          </PanelSection>

          <PanelSection id="adresler" title="Adresler">
            <dl className="-mt-2 divide-y divide-slate-100 text-sm">
              {row("Çıkış", stop(r.from))}
              {row("Varış", stop(r.to))}
            </dl>
            {booking.status === "SCHEDULED" && (
              <div className="mt-3">
                <RouteOverview from={directionsStop(r.from)} to={directionsStop(r.to)} />
              </div>
            )}
          </PanelSection>

          {(booking.canComplete || booking.canCancel) && (
            <PanelSection id="islemler" title="İşlemler">
              <div className="flex flex-wrap items-start gap-3">
                {booking.canComplete && (
                  <ConfirmButton
                    action={completeBooking.bind(null, booking.id, `/firma-paneli/isler/${booking.id}`)}
                    label="İş tamamlandı"
                    confirmText={`${customer.fullName} müşterisinin taşıması bitti mi? Onaylarsan iş tamamlandı olarak kapanır ve müşteriden firmanı değerlendirmesi istenir.`}
                    confirmLabel="Evet, tamamlandı"
                  />
                )}
                {booking.canCancel && (
                  <CancelBookingForm
                    bookingId={booking.id}
                    pagePath={`/firma-paneli/isler/${booking.id}`}
                    consequence={`${customer.fullName} müşterisinin taşıması iptal edilecek ve müşteriye haber verilecek.`}
                  />
                )}
              </div>
            </PanelSection>
          )}
        </aside>
      </div>
    </>
  );
}
