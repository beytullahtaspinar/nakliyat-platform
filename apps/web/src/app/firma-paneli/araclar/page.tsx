import type { Metadata } from "next";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { PageHeader } from "@/components/panel/panel-bits";
import { Badge, Card } from "@/components/ui/card";
import { removeVehicle } from "@/lib/actions/company-vehicles";
import { apiFetch, type CompanyVehicle, type CompanyVehicleSummary } from "@/lib/api";
import { getCompanyContext } from "@/lib/company";
import { formatDate } from "@/lib/format";
import { VEHICLE_LABELS } from "@/lib/request-options";
import { MAX_VEHICLES, VEHICLE_FILES, VEHICLE_STATES, formatPlate } from "@/lib/vehicles";
import { VehicleEdit } from "./vehicle-edit";
import { VehicleForm } from "./vehicle-form";

export const metadata: Metadata = { title: "Araçlar" };

export default async function CompanyVehiclesPage() {
  const { profile, token } = await getCompanyContext();
  if (!profile) return null;
  const { vehicles, verifiedCount } = await apiFetch<CompanyVehicleSummary>("/company/vehicles", { token });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Araçlar"
        description="K3 ya da L1 yetki belgene kayıtlı araçların. Ruhsat ve fotoğrafları yalnızca sen ve platform yöneticileri görebilir."
      />
      <Card className="p-6">
        <h2 className="text-lg font-semibold">Firma doğrulaması için araç</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Firmanın onaylanması için yetki belgene kayıtlı en az bir aracın olmalı. Aracın ruhsatını ve plakası okunacak
          şekilde önden, yandan ve arkadan çekilmiş üç fotoğrafını yükle. Ekibimiz ruhsattaki plakayı fotoğraflardaki
          plakayla karşılaştırıp onaylar.
        </p>
        <p className="mt-3 text-sm font-medium">
          {verifiedCount > 0
            ? `${verifiedCount} onaylı aracın var.`
            : vehicles.some((v) => v.status === "PENDING")
              ? "Aracın inceleniyor."
              : "Henüz onaylı aracın yok."}
        </p>
      </Card>

      {vehicles.map((v) => (
        <VehicleCard key={v.id} vehicle={v} />
      ))}

      {vehicles.length < MAX_VEHICLES && (
        <Card className="p-5" role="region" aria-label={vehicles.length ? "Yeni araç ekle" : "Araç ekle"}>
          <h2 className="font-semibold">{vehicles.length ? "Yeni araç ekle" : "Araç ekle"}</h2>
          <p className="mt-1 mb-4 text-sm text-zinc-600">
            Fotoğrafları gün ışığında, plaka kadrajın içinde ve net olacak şekilde çek. Fotoğraflar yüklenmeden önce
            küçültülür ve konum bilgisi silinir.
          </p>
          <VehicleForm />
        </Card>
      )}
    </div>
  );
}

function VehicleCard({ vehicle: v }: { vehicle: CompanyVehicle }) {
  const state = VEHICLE_STATES[v.status];
  return (
    <Card className="p-5" role="region" aria-label={`${formatPlate(v.plate)} plakalı araç`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="font-mono text-lg font-bold tracking-wider text-zinc-900">{formatPlate(v.plate)}</h3>
        <span className="text-sm text-zinc-600">
          {VEHICLE_LABELS[v.type]} · {v.authorization} yetki belgesi · {formatDate(v.createdAt)}
        </span>
        <Badge tone={state.tone} className="ml-auto">
          {state.label}
        </Badge>
      </div>
      {v.status === "REJECTED" && v.reviewNote && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          Ret gerekçesi: {v.reviewNote}. Düzeltip yeniden gönderebilirsin.
        </p>
      )}
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {VEHICLE_FILES.map((spec) => {
          const file = v.files.find((f) => f.kind === spec.kind);
          return (
            <li key={spec.kind} className="min-w-0 text-sm">
              {file ? (
                <a href={file.url} target="_blank" rel="noopener noreferrer" className="block">
                  {file.mimeType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element -- imzalı, süreli depo adresi
                    <img
                      src={file.url}
                      alt={spec.label}
                      loading="lazy"
                      className="aspect-[4/3] w-full rounded-lg bg-zinc-100 object-cover"
                    />
                  ) : (
                    <span className="flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-zinc-100 font-semibold text-brand-700">
                      PDF
                    </span>
                  )}
                  <span className="mt-1 block font-medium text-brand-700 hover:underline">{spec.label}</span>
                </a>
              ) : (
                <span className="text-zinc-500">{spec.label} yok</span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-start gap-2">
        {v.status !== "VERIFIED" && <VehicleEdit vehicle={v} />}
        <ConfirmButton
          action={removeVehicle.bind(null, v.id)}
          label="Sil"
          confirmText={`${formatPlate(v.plate)} plakalı araç ve dosyaları silinecek.`}
          confirmLabel="Sil"
          variant="quiet"
        />
      </div>
    </Card>
  );
}
