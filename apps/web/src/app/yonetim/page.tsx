import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getAdminContext } from "@/lib/admin";
import { apiFetch, type AdminCompany, type AdminSummary, type Paginated } from "@/lib/api";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: { absolute: "Yönetim" } };

export default async function AdminHomePage() {
  const { token } = await getAdminContext();
  const [summary, pending] = await Promise.all([
    apiFetch<AdminSummary>("/admin/summary", { token }),
    apiFetch<Paginated<AdminCompany>>("/admin/companies?status=PENDING&limit=5", { token }),
  ]);

  const stats = [
    { label: "Onay bekleyen firma", value: summary.companies.pending, href: "/yonetim/firmalar", highlight: summary.companies.pending > 0 },
    { label: "Onaylı firma", value: summary.companies.verified, href: "/yonetim/firmalar?durum=onayli" },
    { label: "Teklif bekleyen talep", value: summary.requests.open, href: "/yonetim/talepler?durum=acik" },
    { label: "Planlanmış iş", value: summary.bookings.scheduled, href: "/yonetim/talepler?durum=firma-secildi" },
    { label: "Müşteri", value: summary.users.customers, href: "/yonetim/kullanicilar?rol=musteri" },
    { label: "Firma hesabı", value: summary.users.companies, href: "/yonetim/kullanicilar?rol=firma" },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Özet</h1>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <li key={s.label}>
            <Link href={s.href} className="block h-full">
              <Card className={`h-full p-4 hover:border-brand-300 ${s.highlight ? "ring-2 ring-accent-400" : ""}`}>
                <p className={`text-3xl font-bold tabular-nums ${s.highlight ? "text-accent-800" : "text-zinc-900"}`}>
                  {s.value}
                </p>
                <p className="mt-1 text-sm text-zinc-600">{s.label}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-lg font-semibold">Onay bekleyen firmalar</h2>
      {pending.items.length === 0 ? (
        <p className="mt-2 text-zinc-600">Bekleyen başvuru yok.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-zinc-600">En eski başvuru en üstte.</p>
          <ul className="mt-3 space-y-2">
            {pending.items.map((c) => (
              <li key={c.id}>
                <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <Link href={`/yonetim/firmalar/${c.id}`} className="font-semibold hover:underline">
                      {c.displayName}
                    </Link>
                    <p className="text-sm text-zinc-600">
                      {c.cityName} · başvuru {formatDate(c.createdAt)}
                      {c.k3LicenseNumber ? "" : " · K3 numarası yok"}
                    </p>
                  </div>
                  <Link href={`/yonetim/firmalar/${c.id}`} className="text-sm font-semibold text-brand-700 hover:underline">
                    İncele →
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
          {pending.total > pending.items.length && (
            <p className="mt-3 text-sm">
              <Link href="/yonetim/firmalar" className="font-semibold text-brand-700 hover:underline">
                Tüm bekleyenler ({pending.total}) →
              </Link>
            </p>
          )}
        </>
      )}
    </>
  );
}
