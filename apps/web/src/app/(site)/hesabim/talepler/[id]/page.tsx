import type { Metadata } from "next";
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
import { ConfirmButton } from "@/components/forms/confirm-button";
import { Conversation } from "@/components/messages/conversation";
import { ReviewCard } from "@/components/reviews/review-card";
import { ReviewForm } from "@/components/reviews/review-form";
import { RequestMediaManager } from "@/components/media/request-media-manager";
import { RouteOverview } from "@/components/map/route-overview";
import { routeText } from "@/lib/geo";

export const metadata: Metadata = {
  title: "Talep ve teklifler",
  robots: { index: false, follow: false },
};

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
    request.status === "BOOKED" || request.status === "COMPLETED"
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
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Link href="/hesabim" className="text-sm text-zinc-500 hover:underline">
        ← Taleplerim
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {place(request.fromCityName, request.fromDistrictName)} → {place(request.toCityName, request.toDistrictName)}
        </h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {homeTypeLabel(request.homeType)} · {formatDate(request.moveDate)}
        {request.isDateFlexible && " (esnek)"}
        {routeText(request) ? ` · ${routeText(request)}` : request.distanceKm ? ` · ${request.distanceKm} km` : ""}
        {request.estimatedVolumeM3 ? ` · yaklaşık ${request.estimatedVolumeM3} m³` : ""}
      </p>

      {draft && (
        <p role="status" className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Talebin hazır, ancak firmalara iletilmesi için hesabını doğrulaman gerekiyor.{" "}
          <Link href={verificationPath(`/hesabim/talepler/${request.id}`)} className="font-semibold underline">
            Şimdi doğrula
          </Link>
        </p>
      )}

      {medya === "eksik" && (
        <p role="status" className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Talebin oluşturuldu, ancak bazı fotoğraf veya videolar yüklenemedi. Aşağıdan tekrar
          ekleyebilirsin.
        </p>
      )}

      {booking && <BookingCard booking={booking} justAccepted={kabul === "1"} />}

      {booking?.status === "COMPLETED" && <ReviewSection booking={booking} />}

      {conversation && (
        <section id="mesajlar" className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">{conversation.counterpart} ile mesajlar</h2>
          <div className="mt-4">
            <Conversation initial={conversation} />
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Teklifler</h2>
        {quotes.length === 0 ? (
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            {acceptable
              ? `Henüz teklif gelmedi. Bölgendeki doğrulanmış firmalar talebini görüyor; teklif verdikçe burada listelenecek. Teklif toplama ${formatDate(request.expiresAt)} tarihinde sona erer.`
              : "Bu talebe teklif gelmedi."}
          </p>
        ) : (
          <>
            {pending.length > 1 && acceptable && (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {pending.length} geçerli teklif, {formatMoney(Math.min(...prices))} ile{" "}
                {formatMoney(Math.max(...prices))} arasında. Teklifler fiyata göre sıralı.
              </p>
            )}
            <ul className="mt-4 space-y-4">
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
          </>
        )}
      </section>

      <RequestDetails request={request} />

      {(acceptable || draft || request.media.length > 0) && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Fotoğraf ve videolar</h2>
          {(acceptable || draft) && (
            <p className="mt-1 text-sm text-zinc-600">
              Eşyalarını görmek firmaların daha doğru fiyat vermesini sağlar. Firmalar yalnızca bu dosyaları görür,
              adres ve iletişim bilgilerini görmez.
            </p>
          )}
          <div className="mt-4">
            <RequestMediaManager requestId={request.id} media={request.media} editable={acceptable || draft} />
          </div>
        </section>
      )}

      {(acceptable || draft) && (
        <div className="mt-8">
          <ConfirmButton
            action={cancelRequest.bind(null, request.id)}
            label="Talebi iptal et"
            confirmText="Talebin iptal edilecek ve firmalar artık teklif veremeyecek. Emin misin?"
            confirmLabel="Evet, iptal et"
            variant="quiet"
          />
        </div>
      )}
    </main>
  );
}

function CompanyLine({ company }: { company: PublicCompany }) {
  const rating = Number(company.ratingAverage);
  return (
    <div>
      <p className="flex flex-wrap items-center gap-2 font-semibold">
        {company.verified ? (
          <Link href={companyPath(company)} className="hover:underline">
            {company.displayName}
          </Link>
        ) : (
          company.displayName
        )}
        {company.verified && (
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">
            ✓ Doğrulanmış firma
          </span>
        )}
      </p>
      <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
        {company.cityName}
        {company.ratingCount > 0 ? ` · ★ ${formatRating(rating)} (${company.ratingCount} yorum)` : " · Henüz yorum yok"}
        {company.completedJobs > 0 && ` · ${company.completedJobs} tamamlanan iş`}
      </p>
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
          ? "border-green-300 dark:border-green-800"
          : isCheapest
            ? "border-blue-300 dark:border-blue-800"
            : "border-zinc-200 dark:border-zinc-800"
      } ${note && quote.status !== "ACCEPTED" ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CompanyLine company={quote.company} />
        <div className="sm:text-right">
          <p className="text-2xl font-semibold">{formatMoney(quote.priceTry)}</p>
          {isCheapest && <p className="text-xs font-medium text-blue-700">En uygun fiyat</p>}
          {note && <p className="text-xs font-medium text-zinc-500">{note}</p>}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-zinc-500">Araç</dt>
          <dd>{VEHICLE_LABELS[quote.vehicleType] ?? quote.vehicleType}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Ekip</dt>
          <dd>{quote.crewSize} kişi</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Geçerlilik</dt>
          <dd>{formatDate(quote.validUntil)}</dd>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-zinc-500">Fiyata dahil</dt>
          <dd>{included.length > 0 ? included.join(", ") : "Yalnızca taşıma"}</dd>
        </div>
      </dl>

      {quote.message && (
        <p className="mt-4 whitespace-pre-line rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900">{quote.message}</p>
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
  return (
    <section className="mt-6 rounded-xl border border-green-300 bg-green-50 p-5 text-green-950 dark:border-green-800 dark:bg-green-950 dark:text-green-100">
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
          {!booking.canComplete && " Taşınma günü geldiğinde işi tamamlandı olarak işaretleyip firmayı değerlendirebileceksin."}
        </p>
      )}
      {booking.canComplete && (
        <div className="mt-4">
          <ConfirmButton
            action={completeBooking.bind(null, booking.id, `/hesabim/talepler/${booking.requestId}`)}
            label="Taşınma tamamlandı"
            confirmText={`${booking.company.displayName} taşımanı bitirdi mi? Onaylarsan iş tamamlandı olarak kapanır ve firmayı değerlendirebilirsin.`}
            confirmLabel="Evet, tamamlandı"
          />
        </div>
      )}
    </section>
  );
}

/** Tamamlanan işte değerlendirme formu ya da yapılmış değerlendirme */
function ReviewSection({ booking }: { booking: CustomerBooking }) {
  const { review, company } = booking;
  return (
    <section id="degerlendirme" className="mt-10 scroll-mt-20">
      <h2 className="text-xl font-semibold">{review ? "Değerlendirmen" : `${company.displayName} firmasını değerlendir`}</h2>
      {review ? (
        <div className="mt-4">
          <ReviewCard review={review} companyName={company.displayName}>
            {!review.isPublished && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Yorumun site kurallarına uymadığı için yayından kaldırıldı.
                {review.hiddenReason && ` Gerekçe: ${review.hiddenReason}`}
              </p>
            )}
          </ReviewCard>
          {review.isPublished && company.verified && (
            <p className="mt-2 text-sm text-zinc-600">
              Yorumun{" "}
              <Link href={`${companyPath(company)}#yorumlar`} className="font-medium text-brand-700 underline">
                firma sayfasında
              </Link>{" "}
              yayında.
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-zinc-600">
            Puanın firmanın ortalamasına eklenir ve taşınacak diğer ailelerin doğru firmayı seçmesine yardım eder.
            Değerlendirme bir kez yapılır, sonradan değiştirilemez.
          </p>
          <div className="mt-4">
            <ReviewForm bookingId={booking.id} pagePath={`/hesabim/talepler/${booking.requestId}`} companyName={company.displayName} />
          </div>
        </>
      )}
    </section>
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
      <dt className="text-zinc-500">{label}</dt>
      <dd className="col-span-2">{value}</dd>
    </div>
  );
  const elevator = (has: boolean) => (has ? "asansörlü" : "asansörsüz");
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold">Talep bilgilerin</h2>
      <dl className="mt-3 divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
        {row("Çıkış adresi", `${request.fromAddress} · ${floorLabel(request.fromFloor)}, ${elevator(request.fromHasElevator)}`)}
        {row("Varış adresi", `${request.toAddress} · ${floorLabel(request.toFloor)}, ${elevator(request.toHasElevator)}`)}
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
      <p className="mt-2 text-xs text-zinc-500">
        Açık adresin ve haritadaki işaretin yalnızca teklifini kabul ettiğin firmayla paylaşılır.
      </p>
    </section>
  );
}
