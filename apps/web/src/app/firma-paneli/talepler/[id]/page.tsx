import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { PageHeader, PanelSection } from "@/components/panel/panel-bits";
import { Badge } from "@/components/ui/card";
import { CheckIcon, CloseIcon } from "@/components/ui/icons";
import { withdrawQuote } from "@/lib/actions/company";
import { ApiError, apiFetch, type CompanyRequestDetail } from "@/lib/api";
import { MediaGallery } from "@/components/media/media-gallery";
import { getCompanyContext } from "@/lib/company";
import { floorLabel, formatDate, formatMoney, place } from "@/lib/format";
import { routeText } from "@/lib/geo";
import { VEHICLE_LABELS, homeTypeLabel, turkeyDate } from "@/lib/request-options";
import {
  QuoteBadge,
  daysText,
  daysUntil,
  isHeavyFloor,
  requestFlags,
  route,
  type RequestFlag,
} from "../../request-bits";
import { QuoteForm } from "./quote-form";

export const metadata: Metadata = { title: "Talep" };

/** Dikkat kutusunda her işaretin açıklaması: firma neden önemli olduğunu tek satırda görsün */
function flagHint(flag: RequestFlag, request: CompanyRequestDetail): string | null {
  switch (flag.key) {
    case "acil":
      return "Ekip ve aracını bu tarihe ayırabileceğinden emin ol.";
    case "cikis-kat":
    case "varis-kat":
      return "Eşyalar merdivenden taşınacak; ekip ve süreyi buna göre hesapla.";
    case "ozel":
      return request.specialItems.join(", ");
    case "Paketleme":
      return "Müşteri eşyalarının paketlenmesini istiyor.";
    case "Söküm/kurulum":
      return "Müşteri mobilyaların sökülüp kurulmasını istiyor.";
    case "Depolama":
      return "Müşteri eşyaların bir süre depoda kalmasını istiyor.";
    default:
      return null;
  }
}

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
  const canQuote = open && profile.verificationStatus === "VERIFIED" && (!quote || quote.status === "PENDING");
  // Not, fotoğraf ve şehirler arası kendi bölümlerinde görünür; dikkat kutusunda fiyatı etkileyenler kalır
  const attention = requestFlags(request).filter((f) => !["not", "medya", "sehirlerarasi"].includes(f.key) && (open || f.key !== "acil"));
  const moveDays = daysUntil(request.moveDate);
  const expiresDays = daysUntil(request.expiresAt);
  const services = [
    { label: "Paketleme", wanted: request.needsPacking },
    { label: "Mobilya söküm ve kurulumu", wanted: request.needsAssembly },
    { label: "Depolama", wanted: request.needsStorage },
  ];
  const facts = [
    {
      label: "Taşınma tarihi",
      value: formatDate(request.moveDate),
      hint: [open ? daysText(moveDays) : null, request.isDateFlexible ? "tarih esnek" : "tarih kesin"].filter(Boolean).join(" · "),
    },
    { label: "Ev tipi", value: homeTypeLabel(request.homeType), hint: request.estimatedVolumeM3 ? `yaklaşık ${request.estimatedVolumeM3} m³ eşya` : null },
    {
      label: "Yol",
      value: routeText(request) ?? (request.distanceKm ? `${request.distanceKm} km` : "Şehir içi"),
      hint: request.fromCityCode !== request.toCityCode ? "şehirler arası" : routeText(request) || request.distanceKm ? "şehir içi" : null,
    },
    {
      label: "Önerilen ekip",
      value: request.estimatedCrew ? `${request.estimatedCrew} kişi` : "—",
      hint: request.estimatedHours ? `yaklaşık ${request.estimatedHours} saat` : null,
    },
  ];
  const ends = [
    { key: "cikis", title: "Çıkış", city: request.fromCityName, district: request.fromDistrictName, floor: request.fromFloor, elevator: request.fromHasElevator },
    { key: "varis", title: "Varış", city: request.toCityName, district: request.toDistrictName, floor: request.toFloor, elevator: request.toHasElevator },
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/firma-paneli/talepler", label: "Gelen talepler" }}
        title={route(request)}
        description={`Talep ${formatDate(request.createdAt)} tarihinde açıldı · ${request.quoteCount} firma teklif verdi`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {quote ? <QuoteBadge quote={quote} /> : open ? <Badge tone="accent">Yeni</Badge> : undefined}
            {canQuote && (
              <a
                href="#teklif"
                className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-800 xl:hidden"
              >
                {quote ? "Teklifine git ↓" : "Teklif ver ↓"}
              </a>
            )}
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <dl className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
            {facts.map((f) => (
              <div key={f.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <dt className="text-xs font-semibold tracking-wide text-slate-600 uppercase">{f.label}</dt>
                <dd className="mt-1 text-base font-bold text-slate-900">{f.value}</dd>
                {f.hint && <dd className="mt-0.5 text-sm text-slate-600">{f.hint}</dd>}
              </div>
            ))}
          </dl>

          {attention.length > 0 && (
            <section aria-labelledby="dikkat-baslik" className="rounded-xl border border-amber-300 bg-amber-50 p-5 sm:p-6">
              <h2 id="dikkat-baslik" className="text-base font-semibold text-amber-950">
                Fiyatı etkileyenler: teklif vermeden önce bak
              </h2>
              <ul className="mt-3 space-y-2.5">
                {attention.map((f) => {
                  const hint = flagHint(f, request);
                  return (
                    <li key={f.key} className="flex gap-3 text-sm">
                      <span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                        !
                      </span>
                      <span>
                        <span className="font-semibold text-amber-950">{f.key === "ozel" ? "Özel eşya" : f.label}</span>
                        {hint && <span className="block text-amber-900">{hint}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <PanelSection
            id="adresler"
            title="Çıkış ve varış"
            description="Müşterinin adı, telefonu ve açık adresi teklifini kabul ettiğinde İşlerim sayfasında açılır."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ends.map((e) => {
                const heavy = isHeavyFloor(e.floor, e.elevator);
                return (
                  <div key={e.key} className={`rounded-lg border p-4 ${heavy ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                    <h3 className="text-xs font-semibold tracking-wide text-slate-600 uppercase">{e.title}</h3>
                    <p className="mt-1 font-semibold text-slate-900">{place(e.city, e.district)}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold text-slate-900">{floorLabel(e.floor)}</span>
                      <Badge tone={e.elevator ? "success" : heavy ? "warning" : "neutral"}>
                        {e.elevator ? "Asansör var" : "Asansör yok"}
                      </Badge>
                    </p>
                  </div>
                );
              })}
            </div>
          </PanelSection>

          <PanelSection id="hizmetler" title="İstenen hizmetler ve eşyalar">
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {services.map((s) => (
                <li
                  key={s.label}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    s.wanted ? "border-accent-300 bg-accent-50 font-semibold text-accent-900" : "border-slate-200 text-slate-600"
                  }`}
                >
                  {s.wanted ? <CheckIcon className="h-4 w-4 shrink-0" /> : <CloseIcon className="h-4 w-4 shrink-0" />}
                  <span>
                    {s.label}
                    <span className="sr-only">{s.wanted ? ": istiyor" : ": istemiyor"}</span>
                  </span>
                </li>
              ))}
            </ul>
            <h3 className="mt-5 text-sm font-semibold text-slate-900">Özel eşyalar</h3>
            {request.specialItems.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {request.specialItems.map((item) => (
                  <li key={item} className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-950">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-slate-600">Müşteri özel eşya belirtmedi.</p>
            )}
          </PanelSection>

          <PanelSection id="not" title="Müşteri notu">
            {request.notes ? (
              <blockquote className="border-l-4 border-brand-700 bg-slate-50 px-4 py-3 text-base whitespace-pre-line text-slate-900">
                {request.notes}
              </blockquote>
            ) : (
              <p className="text-sm text-slate-600">Müşteri not eklemedi.</p>
            )}
          </PanelSection>

          <PanelSection
            id="medya"
            title={`Fotoğraf ve videolar (${request.media.length})`}
            description={request.media.length > 0 ? "Eşyaların miktarını ve büyük parçaları buradan görebilirsin." : undefined}
          >
            {request.media.length > 0 ? (
              <MediaGallery media={request.media} />
            ) : (
              <p className="text-sm text-slate-600">Müşteri fotoğraf veya video eklemedi.</p>
            )}
          </PanelSection>
        </div>

        <aside className="xl:sticky xl:top-4 xl:self-start">
          <PanelSection
            id="teklif"
            title={quote ? "Teklifin" : "Teklif ver"}
            description={
              open ? (
                <>
                  Son teklif günü {formatDate(request.expiresAt)}
                  {expiresDays >= 0 && <> ({daysText(expiresDays)})</>}
                </>
              ) : undefined
            }
          >
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
