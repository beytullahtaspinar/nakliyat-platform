import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { Card } from "@/components/ui/card";
import { withdrawQuote } from "@/lib/actions/company";
import { ApiError, apiFetch, type CompanyRequestDetail } from "@/lib/api";
import { MediaGallery } from "@/components/media/media-gallery";
import { getCompanyContext } from "@/lib/company";
import { formatDate, formatMoney } from "@/lib/format";
import { VEHICLE_LABELS, turkeyDate } from "@/lib/request-options";
import { QuoteBadge, floorText, requestFacts, route, servicesOf } from "../../request-bits";
import { QuoteForm } from "./quote-form";

export const metadata: Metadata = { title: "Talep" };

export default async function CompanyRequestPage({ params }: PageProps<"/firma-paneli/talepler/[id]">) {
  const { id } = await params;
  const { token, profile } = await getCompanyContext();
  if (!profile) return null;

  let request: CompanyRequestDetail;
  try {
    request = await apiFetch<CompanyRequestDetail>(`/company/requests/${encodeURIComponent(id)}`, { token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const quote = request.myQuote;
  const open = request.status === "OPEN" && new Date(request.expiresAt) > new Date();
  const services = servicesOf(request);
  const row = (label: string, value: string) => (
    <div className="grid grid-cols-3 gap-2 py-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="col-span-2">{value}</dd>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section>
        <Link href="/firma-paneli" className="text-sm text-zinc-500 hover:underline">
          ← Gelen talepler
        </Link>
        <h2 className="mt-3 text-xl font-bold">{route(request)}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{requestFacts(request)}</p>
        <dl className="mt-4 divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          {row("Çıkış", floorText(request.fromFloor, request.fromHasElevator))}
          {row("Varış", floorText(request.toFloor, request.toHasElevator))}
          {row("İstenen hizmetler", services.length > 0 ? services.join(", ") : "Yalnızca taşıma")}
          {request.specialItems.length > 0 && row("Özel eşyalar", request.specialItems.join(", "))}
          {request.estimatedCrew && row("Önerilen ekip", `${request.estimatedCrew} kişi${request.estimatedHours ? `, yaklaşık ${request.estimatedHours} saat` : ""}`)}
          {request.notes && row("Müşteri notu", request.notes)}
          {row("Teklif sayısı", `${request.quoteCount} firma teklif verdi`)}
          {row("Son teklif günü", formatDate(request.expiresAt))}
        </dl>
        {request.media.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 font-semibold">Müşterinin eklediği fotoğraf ve videolar</h3>
            <MediaGallery media={request.media} />
          </div>
        )}
        <p className="mt-2 text-xs text-zinc-500">
          Müşterinin adı, telefonu ve açık adresi teklifini kabul ettiğinde &quot;İşlerim&quot; sekmesinde açılır.
        </p>
      </section>

      <aside>
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">{quote ? "Teklifin" : "Teklif ver"}</h3>
            {quote && <QuoteBadge quote={quote} />}
          </div>
          <div className="mt-4">
            {quote && quote.status !== "PENDING" ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {formatMoney(quote.priceTry)} · {VEHICLE_LABELS[quote.vehicleType]} · {quote.crewSize} kişi
                {quote.status === "ACCEPTED" && (
                  <>
                    <br />
                    <Link href="/firma-paneli/isler" className="mt-2 inline-block font-semibold text-brand-700 hover:underline">
                      Müşteri bilgilerini gör →
                    </Link>
                  </>
                )}
              </p>
            ) : !open ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Bu talep artık teklif kabul etmiyor.</p>
            ) : profile.verificationStatus !== "VERIFIED" ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Firman doğrulandıktan sonra bu talebe teklif verebilirsin.
              </p>
            ) : (
              <>
                <QuoteForm
                  request={request}
                  quote={quote}
                  minDate={turkeyDate(1)}
                  maxDate={request.expiresAt.slice(0, 10)}
                />
                {quote && (
                  <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                    <ConfirmButton
                      action={withdrawQuote.bind(null, quote.id)}
                      label="Teklifi geri çek"
                      confirmText="Teklifin müşterinin listesinden kalkacak ve bu talebe yeniden teklif veremeyeceksin."
                      confirmLabel="Evet, geri çek"
                      variant="quiet"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </aside>
    </div>
  );
}
