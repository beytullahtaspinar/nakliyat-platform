import type { Metadata } from "next";
import Link from "next/link";
import { getCityByCode, getDistanceKm } from "@nakliyat/locations";
import type { CalibrationBand } from "@nakliyat/pricing";
import { getAdminContext } from "@/lib/admin";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { PRICE_CALCULATOR_PATH, type AdminPricingView } from "@/lib/pricing";
import { PageHeader } from "../admin-bits";
import { PricingForm } from "./pricing-form";

export const metadata: Metadata = { title: { absolute: "Fiyat hesaplayıcı | Yönetim" } };

const card = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm";
const EXAMPLE_KM = getDistanceKm(getCityByCode("34")!, getCityByCode("06")!)!;

function BandStatus({ title, count, band, minSamples }: { title: string; count: number; band?: CalibrationBand; minSamples: number }) {
  return (
    <div className={card}>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-2xl font-bold text-slate-900">
        {count} <span className="text-sm font-medium text-slate-600">anlaşma</span>
      </p>
      <p className="mt-1 text-sm text-slate-600">
        {band
          ? `Platform verisiyle ayarlanıyor: model fiyatın ${band.factor.toLocaleString("tr-TR")} katı, aralık ±%${band.spreadPct}.`
          : `Katsayılarla hesaplanıyor. Ayarlama için en az ${minSamples} anlaşma gerekiyor.`}
      </p>
    </div>
  );
}

export default async function AdminPricingPage() {
  const { token } = await getAdminContext();
  const view = await apiFetch<AdminPricingView>("/admin/pricing", { token });
  return (
    <>
      <PageHeader
        title="Fiyat hesaplayıcı"
        description={
          <>
            Herkese açık{" "}
            <Link href={PRICE_CALCULATOR_PATH} className="font-medium text-brand-700 hover:underline">
              fiyat hesaplama sayfasının
            </Link>{" "}
            katsayıları. Rakip verisi kullanılmaz; bir grupta yeterli anlaşma birikince tahmin gerçek anlaşma
            fiyatlarına göre kendiliğinden ayarlanır.
            {view.updatedAt && ` Son değişiklik: ${formatDateTime(view.updatedAt)}.`}
          </>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <BandStatus title="Şehir içi" count={view.sampleCounts.local} band={view.calibration.local} minSamples={view.settings.minSamples} />
        <BandStatus
          title="Şehirler arası"
          count={view.sampleCounts.intercity}
          band={view.calibration.intercity}
          minSamples={view.settings.minSamples}
        />
      </div>
      <PricingForm settings={view.settings} defaults={view.defaults} calibration={view.calibration} exampleKm={EXAMPLE_KM} />
    </>
  );
}
