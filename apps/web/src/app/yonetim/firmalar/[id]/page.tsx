import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/components/ui/card";
import { getAdminContext } from "@/lib/admin";
import { ApiError, apiFetch, type AdminCompanyDetail } from "@/lib/api";
import {
  DOCUMENT_LABELS,
  DOCUMENT_TYPES,
  REQUIREMENT_STATES,
  documentState,
  formatBytes,
  formatDay,
} from "@/lib/company-documents";
import { formatDate, formatDateTime, formatPhone } from "@/lib/format";
import { PageHeader, VERIFICATION, VerificationBadge } from "../../admin-bits";
import { CompanyDecision } from "./company-decision";
import { DocumentReview } from "./document-review";
import { ImpersonateButton } from "./impersonate-button";

export const metadata: Metadata = { title: "Firma inceleme" };

const HISTORY_LABELS: Record<string, string> = {
  "company.update": "Bilgiler yönetimden düzenlendi",
  "company.document.upload": "Firma belge yükledi",
  "company.document.approve": "Belge onaylandı",
  "company.document.reject": "Belge reddedildi",
  "company.impersonate": "Firma paneline geçildi",
  "company.impersonate.action": "Firma panelinde değişiklik",
};

/** Firma panelinde yapılan değişikliğin hangi bölüme ait olduğu (API yolundan) */
function panelArea(path?: string): string | undefined {
  if (!path) return undefined;
  if (path.includes("/company/profile")) return "firma bilgileri";
  if (path.includes("/company/documents")) return "belgeler";
  if (path.includes("/quotes")) return "teklifler";
  if (path.includes("/bookings")) return "işler";
  if (path.includes("/notifications")) return "bildirimler";
  if (path.includes("/media")) return "dosyalar";
  return undefined;
}

async function load(token: string, id: string) {
  try {
    return await apiFetch<AdminCompanyDetail>(`/admin/companies/${encodeURIComponent(id)}`, { token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export default async function AdminCompanyPage({ params }: PageProps<"/yonetim/firmalar/[id]">) {
  const { token } = await getAdminContext();
  const { id } = await params;
  const c = await load(token, id);
  const missing = c.requirements.filter((r) => r.state !== "VERIFIED").map((r) => DOCUMENT_LABELS[r.type]);

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/firmalar", label: "Firmalar" }}
        title={c.displayName}
        description={c.legalName}
        actions={
          <div className="flex items-center gap-3">
            <VerificationBadge status={c.verificationStatus} />
            <ImpersonateButton companyId={c.id} />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">Kimlik ve belge bilgileri</h2>
              <Link href={`/yonetim/firmalar/${c.id}/duzenle`} className="text-sm font-semibold text-brand-700 hover:underline">
                Bilgileri düzenle
              </Link>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Ticari unvan" value={c.legalName} />
              <Row label="Vergi / TC kimlik no" value={c.taxNumber} mono />
              <Row label="K3 yetki belgesi no" value={c.k3LicenseNumber ?? "Girilmemiş"} mono={!!c.k3LicenseNumber} />
              <Row label="Merkez il" value={c.cityName ?? c.cityCode} />
              <Row label="Hizmet illeri" value={c.serviceCities.map((city) => city.name ?? city.code).join(", ")} />
              <Row label="Başvuru" value={formatDate(c.createdAt)} />
              {c.verifiedAt && <Row label="Onay tarihi" value={formatDate(c.verifiedAt)} />}
            </dl>
            {c.description && <p className="mt-4 whitespace-pre-line text-sm text-zinc-700">{c.description}</p>}
            <p className="mt-4 text-sm text-zinc-600">
              K3 belgesini e-Devlet&apos;teki Ulaştırma ve Altyapı Bakanlığı yetki belgesi sorgulamasından, vergi numarasını GİB kayıtlarından
              kontrol edip ticari unvanla karşılaştırın.
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold">Belgeler</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Her belgeyi açıp resmî kayıtla karşılaştırın. Zorunlu üç belge onaylanmadan firma onaylanamaz.
            </p>
            <ul className="mt-3 space-y-3">
              {DOCUMENT_TYPES.map((spec) => {
                const docs = c.documents.filter((d) => d.type === spec.type);
                const requirement = c.requirements.find((r) => r.type === spec.type);
                if (!requirement && docs.length === 0) return null;
                return (
                  <li key={spec.type} className="rounded-lg border border-zinc-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{spec.label}</h3>
                      {requirement && (
                        <Badge tone={REQUIREMENT_STATES[requirement.state].tone} className="ml-auto">
                          {REQUIREMENT_STATES[requirement.state].label}
                        </Badge>
                      )}
                    </div>
                    {docs.length === 0 ? (
                      <p className="mt-1 text-sm text-zinc-500">Yüklenmedi.</p>
                    ) : (
                      <ul className="mt-2 space-y-3">
                        {docs.map((d) => {
                          const state = REQUIREMENT_STATES[documentState(d)];
                          return (
                            <li key={d.id} className="space-y-2 border-t border-zinc-100 pt-2 text-sm first:border-0 first:pt-0">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <a
                                    href={d.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="break-all font-medium text-brand-700 hover:underline"
                                  >
                                    {d.fileName}
                                  </a>
                                  <p className="text-zinc-500">
                                    {formatDate(d.createdAt)} · {formatBytes(d.sizeBytes)}
                                    {d.validUntil && ` · Geçerlilik: ${formatDay(d.validUntil)}`}
                                  </p>
                                  {d.reviewNote && <p className="text-zinc-700">Ret gerekçesi: {d.reviewNote}</p>}
                                </div>
                                {(docs.length > 1 || !requirement) && <Badge tone={state.tone}>{state.label}</Badge>}
                              </div>
                              <DocumentReview companyId={c.id} documentId={d.id} status={d.status} />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          {c.history.length > 0 && (
            <Card className="p-5">
              <h2 className="font-semibold">Karar geçmişi</h2>
              <ol className="mt-2 space-y-2 text-sm">
                {c.history.map((h, i) => (
                  <li key={i}>
                    <span className="font-medium">
                      {h.details?.to
                        ? VERIFICATION[h.details.to].label
                        : (HISTORY_LABELS[h.action] ?? h.action)}
                      {h.details?.type && `: ${DOCUMENT_LABELS[h.details.type]}`}
                      {panelArea(h.details?.path) && ` (${panelArea(h.details?.path)})`}
                    </span>{" "}
                    <span className="text-zinc-500">
                      · {h.actor.fullName} ·{" "}
                      {h.action.startsWith("company.impersonate") ? formatDateTime(h.createdAt) : formatDate(h.createdAt)}
                    </span>
                    {h.details?.note && <p className="text-zinc-700">Gerekçe: {h.details.note}</p>}
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">Yetkili kişi</h2>
              <Link href={`/yonetim/kullanicilar/${c.owner.id}`} className="text-sm font-semibold text-brand-700 hover:underline">
                Hesabı yönet
              </Link>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Ad soyad" value={c.owner.fullName} />
              <div>
                <dt className="text-zinc-500">Telefon</dt>
                <dd>
                  <a href={`tel:${c.owner.phone}`} className="font-medium text-brand-700 hover:underline">
                    {formatPhone(c.owner.phone)}
                  </a>
                </dd>
              </div>
              {c.owner.email && <Row label="E-posta" value={c.owner.email} />}
              <Row label="Hesap açılışı" value={formatDate(c.owner.createdAt)} />
            </dl>
            <p className="mt-3 text-sm text-zinc-600">
              {c.quoteCount} teklif · {c.bookingCount} iş
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold">Karar</h2>
            {c.verificationStatus === "REJECTED" && c.verificationNote && (
              <p className="mt-2 text-sm text-zinc-700">Son ret gerekçesi: {c.verificationNote}</p>
            )}
            <div className="mt-3">
              <CompanyDecision companyId={c.id} status={c.verificationStatus} missing={missing} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className={`font-medium text-zinc-900 ${mono ? "font-mono tracking-wide" : ""}`}>{value}</dd>
    </div>
  );
}
