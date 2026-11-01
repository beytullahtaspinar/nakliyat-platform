import type { Metadata } from "next";
import { ReportButton } from "@/components/report-button";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ApiError,
  apiFetch,
  type Conversation as ConversationData,
  type CustomerBooking,
  type CustomerQuote,
  type MovingRequestDetail,
  type Paginated,
  type PublicCompany,
} from "@/lib/api";
import { acceptQuote, cancelRequest } from "@/lib/actions/requests";
import { completeBooking } from "@/lib/actions/reviews";
import { companyPath, formatRating } from "@/lib/reviews";
import { floorLabel, formatDate, formatMoney, formatPhone, place } from "@/lib/format";
import { REQUEST_STATUS, VEHICLE_LABELS, homeTypeLabel } from "@/lib/request-options";
import { getAccessToken, getCurrentUser, homeFor, verificationPath } from "@/lib/session";
import { CompanyLogo } from "@/components/company-logo";
import { BadgeLegend, CompanyBadges } from "@/components/company-badges";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { PageHeader, PanelSection } from "@/components/panel/panel-bits";
import { BookingFollowUp } from "@/components/bookings/booking-follow-up";
import { CancelBookingForm } from "@/components/bookings/cancel-booking-form";
import { DisputeBookingForm } from "@/components/bookings/dispute-booking-form";
import { Conversation } from "@/components/messages/conversation";
import { ReviewCard } from "@/components/reviews/review-card";
import { ReviewEditor } from "@/components/reviews/review-editor";
import { ReviewExcerpt } from "@/components/reviews/review-excerpt";
import { ReviewForm } from "@/components/reviews/review-form";
import { RequestMediaManager } from "@/components/media/request-media-manager";
import { RouteOverview } from "@/components/map/route-overview";
import { routeText } from "@/lib/geo";

export const metadata: Metadata = { title: "Talep ve teklifler" };

async function load(id: string, token: string) {
  try {
    return await Promise.all([
      apiFetch<MovingRequestDetail>(`/requests/${encodeURIComponent(id)}`, { token }),
      apiFetch<CustomerQuote[]>(`/requests/${encodeURIComponent(id)}/quotes`, { token }),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export default async function RequestDetailPage({ params, searchParams }: PageProps<"/hesabim/talepler/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/giris?next=/hesabim/talepler/${encodeURIComponent(id)}`);
  if (user.role !== "CUSTOMER") redirect(homeFor(user.role));

  const token = (await getAccessToken())!;
  const [request, quotes] = await load(id, token);
  const { kabul, medya } = await searchParams;

  const booking =
    request.status === "BOOKED" || request.status === "COMPLETED" || request.status === "CANCELLED"
      ? (await apiFetch<Paginated<CustomerBooking>>("/bookings?limit=50", { token })).items.find(
          (b) => b.requestId === request.id,
        )
      : undefined;

  const conversation = booking
    ? await apiFetch<ConversationData>(`/bookings/${encodeURIComponent(booking.id)}/messages`, { token })
    : undefined;

  const acceptable = request.status === "OPEN";
  // Hesap doğrulanınca yayına girecek taslak: düzenlenebilir ama teklif alamaz
  const draft = request.status === "DRAFT";
  const pending = quotes.filter((q) => q.status === "PENDING" && !q.isExpired);
  const prices = pending.map((q) => Number(q.priceTry));
  const cheapest = prices.length > 1 ? Math.min(...prices) : undefined;
  const status = REQUEST_STATUS[request.status];

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/hesabim", label: "Taleplerim" }}
        title={`${place(request.fromCityName, request.fromDistrictName)} → ${place(request.toCityName, request.toDistrictName)}`}
        description={
          <>
            <span className={`mr-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
            {homeTypeLabel(request.homeType)} · {formatDate(request.moveDate)}
            {request.isDateFlexible && " (esnek)"}
            {routeText(request) ? ` · ${routeText(request)}` : request.distanceKm ? ` · ${request.distanceKm} km` : ""}
            {request.estimatedVolumeM3 ? ` · yaklaşık ${request.estimatedVolumeM3} m³` : ""}
          </>
        }
      />

      {draft && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Talebin hazır, ancak firmalara iletilmesi için hesabını doğrulaman gerekiyor.{" "}
          <Link href={verificationPath(`/hesabim/talepler/${request.id}`)} className="font-semibold underline">
            Şimdi doğrula
          </Link>
        </p>
      )}

      {medya === "eksik" && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Talebin oluşturuldu, ancak bazı fotoğraf veya videolar yüklenemedi. Aşağıdan tekrar
          ekleyebilirsin.
        </p>
      )}

      {booking && <BookingCard booking={booking} justAccepted={kabul === "1"} />}

      {booking?.status === "COMPLETED" && <ReviewSection booking={booking} />}

      {conversation && (
        <PanelSection id="mesajlar" title={`${conversation.counterpart} ile mesajlar`}>
          <Conversation initial={conversation} />
        </PanelSection>
      )}

      <PanelSection
        id="teklifler"
        title="Teklifler"
        description={
          pending.length > 1 && acceptable
            ? `${pending.length} geçerli teklif, ${formatMoney(Math.min(...prices))} ile ${formatMoney(Math.max(...prices))} arasında. Teklifler fiyata göre sıralı.`
            : undefined
        }
      >
        {quotes.length === 0 ? (
          <p className="text-sm text-slate-600">
            {acceptable
              ? `Henüz teklif gelmedi. Bölgendeki doğrulanmış firmalar talebini görüyor; teklif verdikçe burada listelenecek. Teklif toplama ${formatDate(request.expiresAt)} tarihinde sona erer.`
              : "Bu talebe teklif gelmedi."}
          </p>
        ) : (
          <>
            <ul className="space-y-4">
              {quotes.map((q) => (
                <QuoteCard
                  key={q.id}
                  quote={q}
                  isCheapest={cheapest !== undefined && Number(q.priceTry) === cheapest && q.status === "PENDING" && !q.isExpired}
                  canAccept={acceptable && q.status === "PENDING" && !q.isExpired}
                  requestId={request.id}
                />
              ))}
            </ul>
            {quotes.some((q) => q.company.badges?.length) && <BadgeLegend />}
          </>
        )}
      </PanelSection>

      <RequestDetails request={request} />

      {(acceptable || draft || request.media.length > 0) && (
        <PanelSection
          id="medya"
          title="Fotoğraf ve videolar"
          description={
            acceptable || draft
              ? "Eşyalarını görmek firmaların daha doğru fiyat vermesini sağlar. Firmalar yalnızca bu dosyaları görür, adres ve iletişim bilgilerini görmez."
              : undefined
          }
        >
          <RequestMediaManager requestId={request.id} media={request.media} editable={acceptable || draft} />
        </PanelSection>
      )}

      {(acceptable || draft) && (
        <div>
          <ConfirmButton
            action={cancelRequest.bind(null, request.id)}
            label="Talebi iptal et"
            confirmText="Talebin iptal edilecek ve firmalar artık teklif veremeyecek. Emin misin?"
            confirmLabel="Evet, iptal et"
            variant="quiet"
          />
        </div>
      )}
    </div>
  );
}

function CompanyLine({ company }: { company: PublicCompany }) {
  const rating = Number(company.ratingAverage);
  return (
    <div className="flex items-start gap-3">
      {/* /medya adresi yalnızca onaylı firmalarda açılır */}
      <CompanyLogo name={company.displayName} logoUrl={company.verified ? company.logoUrl : null} size="sm" className="mt-0.5" />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {company.verified ? (
            <Link href={companyPath(company)} className="hover:underline">
              {company.displayName}
            </Link>
          ) : (
            company.displayName
          )}
          {/* Belge rozeti doğrulamayı da kapsar; ikisi birlikte gösterilmez */}
          {company.verified && !company.badges?.includes("DOCUMENTS_VERIFIED") && (
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">
              ✓ Doğrulanmış firma
            </span>
          )}
        </p>
        <CompanyBadges badges={company.badges} className="mt-1.5" />
        <p className="mt-0.5 text-sm text-slate-600">
          {company.cityName}
          {company.ratingCount > 0 ? ` · ★ ${formatRating(rating)} (${company.ratingCount} yorum)` : " · Henüz yorum yok"}
          {company.completedJobs > 0 && ` · ${company.completedJobs} tamamlanan iş`}
        </p>
      </div>
    </div>
  );
}

const QUOTE_STATUS_NOTE: Partial<Record<CustomerQuote["status"], string>> = {
  ACCEPTED: "Kabul ettiğin teklif",
  REJECTED: "Başka bir teklif seçildi",
  EXPIRED: "Süresi doldu",
};

function QuoteCard({
  quote,
  isCheapest,
  canAccept,
  requestId,
}: {
  quote: CustomerQuote;
  isCheapest: boolean;
  canAccept: boolean;
  requestId: string;
}) {
  const note = quote.isExpired && quote.status === "PENDING" ? "Süresi doldu" : QUOTE_STATUS_NOTE[quote.status];
  const included = [
    quote.includesPacking && "Paketleme",
    quote.includesAssembly && "Söküm/kurulum",
    quote.includesInsurance && "Taşıma sigortası",
  ].filter(Boolean) as string[];

  return (
    <li
      className={`rounded-xl border p-5 ${
        quote.status === "ACCEPTED"
          ? "border-green-300"
          : isCheapest
            ? "border-brand-300 ring-1 ring-brand-300"
            : "border-slate-200"
      } ${note && quote.status !== "ACCEPTED" ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CompanyLine company={quote.company} />
        <div className="sm:text-right">
          <p className="text-2xl font-semibold">{formatMoney(quote.priceTry)}</p>
          {isCheapest && <p className="text-xs font-medium text-brand-700">En uygun fiyat</p>}
          {note && <p className="text-xs font-medium text-slate-500">{note}</p>}
        </div>
      </div>

      {quote.company.latestReview && quote.company.verified && (
        <ReviewExcerpt
          review={quote.company.latestReview}
          href={`${companyPath(quote.company)}#yorumlar`}
          total={quote.company.ratingCount}
        />
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-slate-500">Araç</dt>
          <dd>{VEHICLE_LABELS[quote.vehicleType] ?? quote.vehicleType}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Ekip</dt>
          <dd>{quote.crewSize} kişi</dd>
        </div>
        <div>
          <dt className="text-slate-500">Geçerlilik</dt>
          <dd>{formatDate(quote.validUntil)}</dd>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-slate-500">Fiyata dahil</dt>
          <dd>{included.length > 0 ? included.join(", ") : "Yalnızca taşıma"}</dd>
        </div>
      </dl>

      {quote.message && (
        <p className="mt-4 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm">{quote.message}</p>
      )}

      {canAccept && (
        <div className="mt-4">
          <ConfirmButton
            action={acceptQuote.bind(null, requestId, quote.id)}
            label="Bu teklifi kabul et"
            confirmText={`${quote.company.displayName} firmasının ${formatMoney(quote.priceTry)} teklifini kabul ediyorsun. Diğer teklifler kapanacak, firmayla iletişim bilgilerin paylaşılacak.`}
            confirmLabel="Evet, kabul et"
          />
        </div>
      )}
    </li>
  );
}

function BookingCard({ booking, justAccepted }: { booking: CustomerBooking; justAccepted: boolean }) {
  const completed = booking.status === "COMPLETED";
  if (booking.status === "CANCELLED") {
    return (
      <section className="rounded-xl border border-slate-300 bg-white p-5 text-slate-900 shadow-sm">
        <h2 className="text-lg font-semibold">Taşıma iptal edildi</h2>
        <p className="mt-1 text-sm">
          {booking.company.displayName} · {formatMoney(booking.priceTry)} · {formatDate(booking.scheduledAt)}
          {booking.cancelledAt && ` · iptal: ${formatDate(booking.cancelledAt)}`}
        </p>
        {booking.cancelReason && <p className="mt-2 text-sm">İptal nedeni: {booking.cancelReason}</p>}
        <BookingFollowUp {...booking} viewer="CUSTOMER" className="mt-2" />
        <p className="mt-3 text-sm">
          Yeniden teklif almak için{" "}
          <Link href="/talep-olustur" className="font-semibold text-brand-700 underline">
            yeni bir talep oluştur
          </Link>
          .
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-xl border border-green-300 bg-green-50 p-5 text-green-950 shadow-sm">
      <h2 className="text-lg font-semibold">
        {completed ? "Taşıman tamamlandı" : justAccepted ? "Teklifi kabul ettin, taşıman planlandı" : "Taşıman planlandı"}
      </h2>
      <p className="mt-1 text-sm">
        {booking.company.displayName} · {formatMoney(booking.priceTry)} · {formatDate(booking.scheduledAt)}
      </p>
      <p className="mt-3 text-sm">
        Firma yetkilisi: <strong>{booking.company.contactName}</strong>
        <br />
        Telefon:{" "}
        <a href={`tel:${booking.company.contactPhone}`} className="font-semibold underline">
          {formatPhone(booking.company.contactPhone)}
        </a>
      </p>
      {booking.status === "SCHEDULED" && (
        <p className="mt-3 text-sm">
          Firma da senin iletişim bilgilerini ve açık adresini artık görebiliyor. Taşınma gününü ve
          detayları aşağıdaki mesajlardan ya da telefonla firmayla netleştirebilirsin.
          {!booking.canComplete && !booking.disputedAt && " Taşınma günü geldiğinde işi tamamlandı olarak işaretleyip firmayı değerlendirebileceksin."}
        </p>
      )}
      <BookingFollowUp {...booking} viewer="CUSTOMER" className="mt-3" />
      {(booking.canComplete || booking.canCancel || booking.canDispute) && (
        <div className="mt-4 flex flex-wrap items-start gap-3">
          {booking.canComplete && (
            <ConfirmButton
              action={completeBooking.bind(null, booking.id, `/hesabim/talepler/${booking.requestId}`)}
              label="Taşınma tamamlandı"
              confirmText={`${booking.company.displayName} taşımanı bitirdi mi? Onaylarsan iş tamamlandı olarak kapanır ve firmayı değerlendirebilirsin.`}
              confirmLabel="Evet, tamamlandı"
            />
          )}
          {booking.canDispute && (
            <DisputeBookingForm bookingId={booking.id} pagePath={`/hesabim/talepler/${booking.requestId}`} counterpart={booking.company.displayName} />
          )}
          {booking.canCancel && (
            <CancelBookingForm
              bookingId={booking.id}
              pagePath={`/hesabim/talepler/${booking.requestId}`}
              consequence={`${booking.company.displayName} ile anlaştığın taşıma iptal edilecek ve firmaya haber verilecek. Yeniden teklif almak için yeni talep oluşturman gerekir.`}
            />
          )}
        </div>
      )}
    </section>
  );
}

/** Tamamlanan işte değerlendirme formu ya da yapılmış değerlendirme */
function ReviewSection({ booking }: { booking: CustomerBooking }) {
  const { review, company } = booking;
  return (
    <PanelSection
      id="degerlendirme"
      title={review ? "Değerlendirmen" : `${company.displayName} firmasını değerlendir`}
      description={
        review
          ? undefined
          : "Puanın firmanın ortalamasına eklenir ve taşınacak diğer ailelerin doğru firmayı seçmesine yardım eder. Fikrin değişirse değerlendirmeni sonradan düzenleyebilirsin."
      }
    >
      {review ? (
        <div>
          <ReviewCard review={review} companyName={company.displayName}>
            {!review.isPublished && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Yorumun site kurallarına uymadığı için yayından kaldırıldı.
                {review.hiddenReason && ` Gerekçe: ${review.hiddenReason}`}
              </p>
            )}
            {review.companyReply && (
              <div className="mt-2 text-right">
                <ReportButton target="REVIEW_REPLY" targetId={review.id} />
              </div>
            )}
          </ReviewCard>
          {review.isPublished && company.verified && (
            <p className="mt-2 text-sm text-slate-600">
              Yorumun{" "}
              <Link href={`${companyPath(company)}#yorumlar`} className="font-medium text-brand-700 underline">
                firma sayfasında
              </Link>{" "}
              &ldquo;Doğrulanmış taşıma&rdquo; rozetiyle yayında.
            </p>
          )}
          {/* Yönetimce kaldırılan yorum düzenlenemez: gizleme gerekçesi o metne ait */}
          {review.isPublished && (
            <ReviewEditor
              bookingId={booking.id}
              pagePath={`/hesabim/talepler/${booking.requestId}`}
              companyName={company.displayName}
              review={review}
              hasReply={!!review.companyReply}
            />
          )}
        </div>
      ) : (
        <ReviewForm bookingId={booking.id} pagePath={`/hesabim/talepler/${booking.requestId}`} companyName={company.displayName} />
      )}
    </PanelSection>
  );
}

const pinOf = (r: MovingRequestDetail, side: "from" | "to") => {
  const lat = r[`${side}Lat`];
  const lng = r[`${side}Lng`];
  return lat != null && lng != null ? { lat, lng } : null;
};

function RequestDetails({ request }: { request: MovingRequestDetail }) {
  const services = [
    request.needsPacking && "Paketleme",
    request.needsAssembly && "Söküm/kurulum",
    request.needsStorage && "Depolama",
  ].filter(Boolean) as string[];
  const row = (label: string, value: string) => (
    <div className="grid grid-cols-3 gap-2 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="col-span-2">{value}</dd>
    </div>
  );
  const elevator = (has: boolean) => (has ? "asansörlü" : "asansörsüz");
  return (
    <PanelSection id="talep-bilgileri" title="Talep bilgilerin">
      <dl className="-mt-2 divide-y divide-slate-100 text-sm">
        {row("Çıkış adresi", `${request.fromAddress || "Açık adres yazılmadı"} · ${floorLabel(request.fromFloor)}, ${elevator(request.fromHasElevator)}`)}
        {row("Varış adresi", `${request.toAddress || "Açık adres yazılmadı"} · ${floorLabel(request.toFloor)}, ${elevator(request.toHasElevator)}`)}
        {request.routeKm != null && row("Yol", `${routeText(request)} (haritadaki işaretlerine göre, kamyonla)`)}
        {row("Ek hizmetler", services.length > 0 ? services.join(", ") : "Yok")}
        {request.specialItems.length > 0 && row("Özel eşyalar", request.specialItems.join(", "))}
        {request.notes && row("Notun", request.notes)}
      </dl>
      {(pinOf(request, "from") || pinOf(request, "to")) && (
        <div className="mt-3">
          <RouteOverview
            from={{ location: pinOf(request, "from"), text: request.fromAddress }}
            to={{ location: pinOf(request, "to"), text: request.toAddress }}
            directions={false}
          />
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Açık adresin ve haritadaki işaretin yalnızca teklifini kabul ettiğin firmayla paylaşılır.
      </p>
    </PanelSection>
  );
}
