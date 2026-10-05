import type { Metadata } from "next";
import { PageHeader } from "@/components/panel/panel-bits";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { Badge, Card } from "@/components/ui/card";
import { removeDocument } from "@/lib/actions/company-documents";
import { apiFetch, type CompanyDocument, type CompanyDocumentSummary } from "@/lib/api";
import { getCompanyContext } from "@/lib/company";
import {
  DOCUMENT_TYPES,
  MAX_OTHER_DOCUMENTS,
  REQUIREMENT_STATES,
  documentState,
  expiresSoon,
  formatBytes,
  formatDay,
} from "@/lib/company-documents";
import { formatDate } from "@/lib/format";
import { DocumentUpload } from "./document-upload";

export const metadata: Metadata = { title: "Belgeler" };

export default async function CompanyDocumentsPage() {
  const { profile, token } = await getCompanyContext();
  if (!profile) return null;
  const { documents, requirements } = await apiFetch<CompanyDocumentSummary>("/company/documents", { token });
  const missing = requirements.filter((r) => r.state !== "VERIFIED").length;

  return (
    <div className="space-y-4">
      <PageHeader title="Belgeler" description="Doğrulama ve isteğe bağlı belgelerin; yalnızca sen ve platform yöneticileri görebilir." />
      <Card className="p-6">
        <h2 className="text-lg font-semibold">Doğrulama belgeleri</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Teklif verebilmek için üç zorunlu belgeyi yükle. Ekibimiz belgeleri resmî kayıtlarla karşılaştırır;
          sonuç firma panelinde ve e-postanda görünür. Belgelerini yalnızca sen ve platform yöneticileri görebilir.
        </p>
        <p className="mt-3 text-sm font-medium">
          {missing === 0
            ? "Zorunlu belgelerinin hepsi onaylandı."
            : `${requirements.length - missing}/${requirements.length} zorunlu belge onaylandı.`}
        </p>
      </Card>

      {DOCUMENT_TYPES.map((spec) => {
        const ofType = documents.filter((d) => d.type === spec.type);
        const requirement = requirements.find((r) => r.type === spec.type);
        const state = requirement?.state ?? (ofType[0] ? documentState(ofType[0]) : "MISSING");
        const badge = REQUIREMENT_STATES[state];
        const canUpload = spec.type !== "OTHER" || ofType.length < MAX_OTHER_DOCUMENTS;
        return (
          <Card key={spec.type} className="p-5" role="region" aria-label={spec.label}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">
                {spec.label}
              </h3>
              <span className="text-xs text-zinc-500">{spec.required ? "Zorunlu" : "İsteğe bağlı"}</span>
              {(spec.required || ofType.length > 0) && spec.type !== "OTHER" && (
                <Badge tone={badge.tone} className="ml-auto">
                  {badge.label}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-zinc-600">{spec.hint}</p>

            {ofType.length > 0 && (
              <ul className="mt-3 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                {ofType.map((d) => (
                  <DocumentRow key={d.id} document={d} showState={ofType.length > 1 || spec.type === "OTHER"} />
                ))}
              </ul>
            )}

            {canUpload && (
              <DocumentUpload
                type={spec.type}
                dated={spec.dated}
                label={ofType.length > 0 && spec.type !== "OTHER" ? "Yenisini yükle" : "Yükle"}
              />
            )}
          </Card>
        );
      })}
    </div>
  );
}

/** Türün tek belgesinde durum zaten başlıkta görünür */
function DocumentRow({ document: d, showState }: { document: CompanyDocument; showState: boolean }) {
  const state = REQUIREMENT_STATES[documentState(d)];
  const soon = d.status === "VERIFIED" && !d.expired && expiresSoon(d.validUntil);
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
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
        {d.status === "REJECTED" && d.reviewNote && <p className="mt-1 text-red-800">Ret gerekçesi: {d.reviewNote}</p>}
        {soon && <p className="mt-1 text-amber-900">Belgenin süresi yakında doluyor, yenisini yükle.</p>}
        {d.expired && <p className="mt-1 text-red-800">Belgenin süresi dolmuş, yenisini yükle.</p>}
      </div>
      <div className="flex flex-col items-end gap-2">
        {showState && <Badge tone={state.tone}>{state.label}</Badge>}
        {d.status !== "VERIFIED" && (
          <ConfirmButton
            action={removeDocument.bind(null, d.id)}
            label="Sil"
            confirmText="Bu belge silinecek."
            confirmLabel="Sil"
            variant="quiet"
          />
        )}
      </div>
    </li>
  );
}
