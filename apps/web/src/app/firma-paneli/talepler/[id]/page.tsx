import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { PageHeader, PanelSection } from "@/components/panel/panel-bits";
import { Badge } from "@/components/ui/card";
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
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-2 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-900">{value}</dd>
    </div>
  );

  return (
    <>
      <PageHeader
        back={{ href: "/firma-paneli/talepler", label: "Gelen talepler" }}
        title={route(request)}
        description={requestFacts(request)}
        actions={quote ? <QuoteBadge quote={quote} /> : open ? <Badge tone="accent">Yeni</Badge> : undefined}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <PanelSection
            id="talep"
            title="Talep bilgileri"
            description="Müşterinin adı, telefonu ve açık adresi teklifini kabul ettiğinde İşlerim sayfasında açılır."
          >
            <dl className="-my-2 divide-y divide-slate-100 text-sm">
              {row("Çıkış", floorText(request.fromFloor, request.fromHasElevator))}
              {row("Varış", floorText(request.toFloor, request.toHasElevator))}
              {row("İstenen hizmetler", services.length > 0 ? services.join(", ") : "Yalnızca taşıma")}
              {request.specialItems.length > 0 && row("Özel eşyalar", request.specialItems.join(", "))}
              {request.estimatedCrew && row("Önerilen ekip", `${request.estimatedCrew} kişi${request.estimatedHours ? `, yaklaşık ${request.estimatedHours} saat` : ""}`)}
              {request.notes && row("Müşteri notu", request.notes)}
              {row("Teklif sayısı", `${request.quoteCount} firma teklif verdi`)}
              {row("Son teklif günü", formatDate(request.expiresAt))}
            </dl>
          </PanelSection>
          {request.media.length > 0 && (
            <PanelSection id="medya" title="Müşterinin eklediği fotoğraf ve videolar">
              <MediaGallery media={request.media} />
            </PanelSection>
          )}
        </div>

        <aside>
          <PanelSection id="teklif" title={quote ? "Teklifin" : "Teklif ver"}>
            {quote && quote.status !== "PENDING" ? (
              <p className="text-sm text-slate-600">
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
              <p className="text-sm text-slate-600">Bu talep artık teklif kabul etmiyor.</p>
            ) : profile.verificationStatus !== "VERIFIED" ? (
              <p className="text-sm text-slate-600">Firman doğrulandıktan sonra bu talebe teklif verebilirsin.</p>
            ) : (
              <>
                <QuoteForm
                  request={request}
                  quote={quote}
                  minDate={turkeyDate(1)}
                  maxDate={request.expiresAt.slice(0, 10)}
                />
                {quote && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
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
          </PanelSection>
        </aside>
      </div>
    </>
  );
}
