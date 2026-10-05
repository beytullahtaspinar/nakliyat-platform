import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError, apiFetch, type CompanyBooking, type Conversation as ConversationData, type Paginated } from "@/lib/api";
import { getCompanyContext } from "@/lib/company";
import { formatDate, formatMoney, formatPhone, place } from "@/lib/format";
import { homeTypeLabel } from "@/lib/request-options";
import { Conversation } from "@/components/messages/conversation";
import { CancelBookingForm } from "@/components/bookings/cancel-booking-form";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { ReplyForm } from "@/components/reviews/reply-form";
import { ReviewCard } from "@/components/reviews/review-card";
import { completeBooking } from "@/lib/actions/reviews";

export const metadata: Metadata = { title: "Müşteriyle mesajlar" };

export default async function CompanyBookingMessagesPage({ params }: PageProps<"/firma-paneli/isler/[id]">) {
  const { id } = await params;
  const { token, profile } = await getCompanyContext();
  if (!profile) return null;

  let conversation: ConversationData;
  try {
    conversation = await apiFetch<ConversationData>(`/bookings/${encodeURIComponent(id)}/messages`, { token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const { items } = await apiFetch<Paginated<CompanyBooking>>("/company/bookings?limit=50", { token });
  const booking = items.find((b) => b.id === id);

  return (
    <div>
      <Link href="/firma-paneli/isler" className="text-sm text-zinc-600 hover:underline">
        ← İşlerim
      </Link>
      <h2 className="mt-3 text-xl font-semibold">{conversation.counterpart} ile mesajlar</h2>
      {booking && (
        <p className="mt-1 text-sm text-zinc-600">
          {place(booking.request.from.cityName, booking.request.from.districtName)} →{" "}
          {place(booking.request.to.cityName, booking.request.to.districtName)} · {homeTypeLabel(booking.request.homeType)} ·{" "}
          {formatDate(booking.scheduledAt)} · {formatMoney(booking.priceTry)} · Telefon:{" "}
          <a href={`tel:${booking.customer.phone}`} className="font-semibold text-brand-700 underline">
            {formatPhone(booking.customer.phone)}
          </a>
        </p>
      )}
      {booking?.status === "CANCELLED" && (
        <p className="mt-4 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800">
          Bu iş iptal edildi{booking.cancelledAt && ` (${formatDate(booking.cancelledAt)})`}.
          {booking.cancelReason && ` İptal nedeni: ${booking.cancelReason}`}
        </p>
      )}
      {booking && (booking.canComplete || booking.canCancel) && (
        <div className="mt-4 flex flex-wrap items-start gap-3">
          {booking.canComplete && (
            <ConfirmButton
              action={completeBooking.bind(null, booking.id, `/firma-paneli/isler/${booking.id}`)}
              label="İş tamamlandı"
              confirmText={`${booking.customer.fullName} müşterisinin taşıması bitti mi? Onaylarsan iş tamamlandı olarak kapanır ve müşteriden firmanı değerlendirmesi istenir.`}
              confirmLabel="Evet, tamamlandı"
            />
          )}
          {booking.canCancel && (
            <CancelBookingForm
              bookingId={booking.id}
              pagePath={`/firma-paneli/isler/${booking.id}`}
              consequence={`${booking.customer.fullName} müşterisinin taşıması iptal edilecek ve müşteriye haber verilecek.`}
            />
          )}
        </div>
      )}
      {booking?.status === "COMPLETED" && (
        <section id="degerlendirme" className="mt-6 scroll-mt-20">
          <h3 className="text-lg font-semibold">Müşterinin değerlendirmesi</h3>
          {booking.review ? (
            <div className="mt-3">
              <ReviewCard review={booking.review} companyName={profile.displayName}>
                {!booking.review.isPublished && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Bu yorum yönetim tarafından yayından kaldırıldı ve puan ortalamana girmiyor.
                    {booking.review.hiddenReason && ` Gerekçe: ${booking.review.hiddenReason}`}
                  </p>
                )}
                {!booking.review.companyReply && <ReplyForm reviewId={booking.review.id} />}
              </ReviewCard>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">
              İş tamamlandı. Müşteri henüz değerlendirme yapmadı; yaptığında burada ve Değerlendirmeler sayfasında görünür.
            </p>
          )}
        </section>
      )}
      <div className="mt-4">
        <Conversation initial={conversation} refreshBadges />
      </div>
    </div>
  );
}
