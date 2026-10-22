import { Badge } from "@/components/ui/card";
import type { CompanyVehicle } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { VEHICLE_LABELS } from "@/lib/request-options";
import { VEHICLE_FILES, VEHICLE_STATES, formatPlate } from "@/lib/vehicles";
import { VehicleReview } from "./vehicle-review";

/**
 * Araç incelemesi: girilen plaka, ruhsat ve önden/yandan/arkadan fotoğraflar yan yana. Yönetici ruhsattaki plakayı
 * fotoğraflardakiyle karşılaştırır; görsele tıklayınca tam boyutu yeni sekmede açılır (yakınlaştırmak için).
 */
export function VehicleInspection({ companyId, vehicle: v }: { companyId: string; vehicle: CompanyVehicle }) {
  const state = VEHICLE_STATES[v.status];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rounded-md border-2 border-slate-900 bg-white px-2 py-0.5 font-mono text-lg font-bold tracking-wider text-slate-900">
          {formatPlate(v.plate)}
        </span>
        <span className="text-sm text-slate-600">
          {VEHICLE_LABELS[v.type]} · {v.authorization} yetki belgesi · {formatDate(v.updatedAt)}
        </span>
        <Badge tone={state.tone} className="ml-auto">
          {state.label}
        </Badge>
      </div>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {VEHICLE_FILES.map((spec) => {
          const file = v.files.find((f) => f.kind === spec.kind);
          return (
            <li key={spec.kind} className="min-w-0 text-sm">
              <p className="mb-1 font-medium text-slate-800">{spec.label}</p>
              {file ? (
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg ring-1 ring-slate-200 hover:ring-brand-700"
                  aria-label={`${spec.label}: tam boyutta aç`}
                >
                  {file.mimeType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element -- imzalı, süreli depo adresi
                    <img
                      src={file.url}
                      alt={`${formatPlate(v.plate)} ${spec.label.toLowerCase()}`}
                      loading="lazy"
                      className="aspect-[4/3] w-full rounded-lg bg-slate-100 object-contain"
                    />
                  ) : (
                    <span className="flex aspect-[4/3] w-full flex-col items-center justify-center rounded-lg bg-slate-100 font-semibold text-brand-700">
                      PDF
                      <span className="mt-1 text-xs font-normal">Ruhsatı aç</span>
                    </span>
                  )}
                </a>
              ) : (
                <p className="text-slate-500">Yüklenmedi.</p>
              )}
            </li>
          );
        })}
      </ul>
      {v.reviewNote && <p className="text-sm text-slate-700">Ret gerekçesi: {v.reviewNote}</p>}
      <VehicleReview companyId={companyId} vehicleId={v.id} status={v.status} />
    </div>
  );
}
