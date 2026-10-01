import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getAdminContext } from "@/lib/admin";
import { ApiError, apiFetch, type AdminCompanyDetail, type CompanyDocument } from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/format";
import { VERIFICATION, VerificationBadge } from "../../admin-bits";
import { CompanyDecision } from "./company-decision";

export const metadata: Metadata = { title: "Firma inceleme" };

const DOCUMENT_LABELS: Record<CompanyDocument["type"], string> = {
  K3_LICENSE: "K3 yetki belgesi",
  TAX_CERTIFICATE: "Vergi levhası",
  TRADE_REGISTRY: "Ticaret sicil gazetesi",
  INSURANCE: "Sigorta poliçesi",
  OTHER: "Diğer belge",
};

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

  return (
    <>
      <p className="text-sm">
        <Link href="/yonetim/firmalar" className="font-medium text-brand-700 hover:underline">
          ← Firmalar
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{c.displayName}</h1>
          <p className="text-zinc-600">{c.legalName}</p>
        </div>
        <VerificationBadge status={c.verificationStatus} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="font-semibold">Kimlik ve belge bilgileri</h2>
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
            <h2 className="font-semibold">Yüklenen belgeler</h2>
            {c.documents.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-600">
                Firma henüz belge yüklemedi. Belge yükleme özelliği gelene kadar K3 ve vergi numarasını resmî sorgu
                sayfalarından kontrol edin.
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {c.documents.map((d) => (
                  <li key={d.id} className="flex flex-wrap justify-between gap-2">
                    <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 hover:underline">
                      {DOCUMENT_LABELS[d.type]}
                    </a>
                    <span className="text-zinc-500">{formatDate(d.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {c.history.length > 0 && (
            <Card className="p-5">
              <h2 className="font-semibold">Karar geçmişi</h2>
              <ol className="mt-2 space-y-2 text-sm">
                {c.history.map((h, i) => (
                  <li key={i}>
                    <span className="font-medium">
                      {h.details?.to ? VERIFICATION[h.details.to].label : h.action}
                    </span>{" "}
                    <span className="text-zinc-500">
                      · {h.actor.fullName} · {formatDate(h.createdAt)}
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
            <h2 className="font-semibold">Yetkili kişi</h2>
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
              <CompanyDecision companyId={c.id} status={c.verificationStatus} />
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
