import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ApiError,
  apiFetch,
  type CustomerBooking,
  type CustomerQuote,
  type MovingRequestDetail,
  type Paginated,
  type PublicCompany,
} from "@/lib/api";
import { acceptQuote, cancelRequest } from "@/lib/actions/requests";
import { floorLabel, formatDate, formatMoney, formatPhone, place } from "@/lib/format";
import { REQUEST_STATUS, VEHICLE_LABELS, homeTypeLabel } from "@/lib/request-options";
import { getAccessToken, getCurrentUser, homeFor } from "@/lib/session";
import { ConfirmButton } from "@/components/forms/confirm-button";

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
  const { kabul } = await searchParams;

  const booking =
    request.status === "BOOKED" || request.status === "COMPLETED"
      ? (await apiFetch<Paginated<CustomerBooking>>("/bookings?limit=50", { token })).items.find(
          (b) => b.requestId === request.id,
        )
      : undefined;

  const acceptable = request.status === "OPEN";
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
        {request.distanceKm ? ` · ${request.distanceKm} km` : ""}
        {request.estimatedVolumeM3 ? ` · yaklaşık ${request.estimatedVolumeM3} m³` : ""}
      </p>

      {booking && <BookingCard booking={booking} justAccepted={kabul === "1"} />}

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

      {acceptable && (
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
        {company.displayName}
        {company.verified && (
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">
            ✓ Doğrulanmış firma
          </span>
        )}
      </p>
      <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
        {company.cityName}
        {company.ratingCount > 0 ? ` · ★ ${rating.toFixed(1)} (${company.ratingCount} yorum)` : " · Henüz yorum yok"}
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
  return (
    <section className="mt-6 rounded-xl border border-green-300 bg-green-50 p-5 text-green-950 dark:border-green-800 dark:bg-green-950 dark:text-green-100">
      <h2 className="text-lg font-semibold">
        {justAccepted ? "Teklifi kabul ettin, taşıman planlandı" : "Taşıman planlandı"}
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
      <p className="mt-3 text-sm">
        Firma da senin iletişim bilgilerini ve açık adresini artık görebiliyor. Taşınma gününü ve
        detayları doğrudan firmayla netleştirebilirsin.
      </p>
    </section>
  );
}

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
        {row("Ek hizmetler", services.length > 0 ? services.join(", ") : "Yok")}
        {request.specialItems.length > 0 && row("Özel eşyalar", request.specialItems.join(", "))}
        {request.notes && row("Notun", request.notes)}
      </dl>
      <p className="mt-2 text-xs text-zinc-500">
        Açık adresin yalnızca teklifini kabul ettiğin firmayla paylaşılır.
      </p>
    </section>
  );
}
