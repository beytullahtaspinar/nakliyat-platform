import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getAdminContext } from "@/lib/admin";
import { ApiError, apiFetch, type AdminRequestDetail } from "@/lib/api";
import { floorLabel, formatDate, formatMoney, formatPhone, place } from "@/lib/format";
import { routeText } from "@/lib/geo";
import { REQUEST_STATUS, VEHICLE_LABELS, homeTypeLabel } from "@/lib/request-options";
import { DataTable, EmptyRow, PageHeader, VerificationBadge, td, th } from "../../admin-bits";
import { MediaGallery } from "@/components/media/media-gallery";

export const metadata: Metadata = { title: "Talep" };

const QUOTE_STATUS: Record<AdminRequestDetail["quotes"][number]["status"], string> = {
  PENDING: "Bekliyor",
  ACCEPTED: "Kabul edildi",
  REJECTED: "Seçilmedi",
  WITHDRAWN: "Geri çekildi",
  EXPIRED: "Süresi doldu",
};
const BOOKING_STATUS = { SCHEDULED: "Planlandı", COMPLETED: "Tamamlandı", CANCELLED: "İptal edildi" } as const;

export default async function AdminRequestPage({ params }: PageProps<"/yonetim/talepler/[id]">) {
  const { token } = await getAdminContext();
  const { id } = await params;
  const r = await apiFetch<AdminRequestDetail>(`/admin/requests/${encodeURIComponent(id)}`, { token }).catch((err) => {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  });
  const status = REQUEST_STATUS[r.status];
  const services = [r.needsPacking && "Paketleme", r.needsAssembly && "Söküm/kurulum", r.needsStorage && "Depolama"].filter(Boolean);

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/talepler", label: "Talepler" }}
        title={`${place(r.fromCityName, r.fromDistrictName)} → ${place(r.toCityName, r.toDistrictName)}`}
        description={`Açıldı ${formatDate(r.createdAt)} · son teklif günü ${formatDate(r.expiresAt)}`}
        actions={<span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>{status.label}</span>}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="font-semibold">Taşınma bilgileri</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Row label="Nereden" value={`${r.fromAddress}, ${place(r.fromCityName, r.fromDistrictName)}`} sub={`${floorLabel(r.fromFloor)}, ${r.fromHasElevator ? "asansörlü" : "asansörsüz"}`} />
              <Row label="Nereye" value={`${r.toAddress}, ${place(r.toCityName, r.toDistrictName)}`} sub={`${floorLabel(r.toFloor)}, ${r.toHasElevator ? "asansörlü" : "asansörsüz"}`} />
              <Row label="Ev tipi" value={homeTypeLabel(r.homeType)} />
              <Row label="Taşınma tarihi" value={`${formatDate(r.moveDate)}${r.isDateFlexible ? " (esnek)" : ""}`} />
              <Row
                label="Mesafe"
                value={routeText(r) ?? (r.distanceKm ? `${r.distanceKm} km` : "Şehir içi")}
                sub={r.routeKm != null ? "Haritadaki işaretler arası yol" : r.distanceKm ? "İl merkezleri arası" : undefined}
              />
              <Row
                label="Tahmin"
                value={[r.estimatedVolumeM3 && `~${r.estimatedVolumeM3} m³`, r.estimatedCrew && `${r.estimatedCrew} kişi`, r.estimatedHours && `${r.estimatedHours} saat`].filter(Boolean).join(" · ") || "—"}
              />
              <Row label="Ek hizmetler" value={services.length ? services.join(", ") : "Yok"} />
              {r.specialItems.length > 0 && <Row label="Özel eşyalar" value={r.specialItems.join(", ")} />}
            </dl>
            {r.notes && <p className="mt-4 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{r.notes}</p>}
          </Card>

          {r.media.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 font-semibold">Fotoğraf ve videolar ({r.media.length})</h2>
              <MediaGallery media={r.media} />
            </Card>
          )}

          <section aria-labelledby="teklifler">
            <h2 id="teklifler" className="mb-2 font-semibold text-slate-900">
              Teklifler ({r.quotes.length})
            </h2>
            <DataTable label="Gelen teklifler, fiyata göre">
              <thead>
                <tr>
                  <th scope="col" className={th}>Firma</th>
                  <th scope="col" className={th}>Fiyat</th>
                  <th scope="col" className={th}>Ekip / araç</th>
                  <th scope="col" className={th}>Dahil</th>
                  <th scope="col" className={th}>Durum</th>
                  <th scope="col" className={th}>Verildi</th>
                </tr>
              </thead>
              <tbody>
                {r.quotes.length === 0 && <EmptyRow colSpan={6}>Henüz teklif yok.</EmptyRow>}
                {r.quotes.map((q) => (
                  <tr key={q.id} className={q.status === "ACCEPTED" ? "bg-green-50" : "hover:bg-slate-50"}>
                    <td className={td}>
                      <Link href={`/yonetim/firmalar/${q.company.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                        {q.company.displayName}
                      </Link>
                      {q.company.verificationStatus !== "VERIFIED" && (
                        <div className="mt-1">
                          <VerificationBadge status={q.company.verificationStatus} />
                        </div>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap font-semibold tabular-nums`}>{formatMoney(q.priceTry)}</td>
                    <td className={td}>
                      {q.crewSize} kişi · {VEHICLE_LABELS[q.vehicleType] ?? q.vehicleType}
                    </td>
                    <td className={td}>
                      {[q.includesPacking && "Paketleme", q.includesAssembly && "Kurulum", q.includesInsurance && "Sigorta"].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className={td}>{QUOTE_STATUS[q.status]}</td>
                    <td className={`${td} whitespace-nowrap text-slate-600`}>{formatDate(q.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </section>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="font-semibold">Müşteri</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Ad soyad" value={r.customer.fullName} />
              <div>
                <dt className="text-slate-500">Telefon</dt>
                <dd>
                  <a href={`tel:${r.customer.phone}`} className="font-medium text-brand-700 hover:underline">
                    {formatPhone(r.customer.phone)}
                  </a>
                </dd>
              </div>
              {r.customer.email && <Row label="E-posta" value={r.customer.email} />}
            </dl>
            <p className="mt-3 text-sm">
              <Link href={`/yonetim/kullanicilar/${r.customer.id}`} className="font-semibold text-brand-700 hover:underline">
                Hesabı yönet
              </Link>
            </p>
          </Card>
          {r.booking && (
            <Card className="p-5">
              <h2 className="font-semibold">İş</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="Durum" value={BOOKING_STATUS[r.booking.status]} />
                <Row label="Planlanan tarih" value={formatDate(r.booking.scheduledAt)} />
                {r.booking.completedAt && <Row label="Tamamlandı" value={formatDate(r.booking.completedAt)} />}
                {r.booking.cancelReason && <Row label="İptal nedeni" value={r.booking.cancelReason} />}
              </dl>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
      {sub && <dd className="text-slate-600">{sub}</dd>}
    </div>
  );
}
