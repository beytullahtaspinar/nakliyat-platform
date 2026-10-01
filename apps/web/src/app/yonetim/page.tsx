import type { Metadata } from "next";
import Link from "next/link";
import { getAdminContext } from "@/lib/admin";
import { apiFetch, type AdminCompany, type AdminRequest, type AdminSummary, type Paginated } from "@/lib/api";
import { formatDate, formatPhone, place } from "@/lib/format";
import { REQUEST_STATUS } from "@/lib/request-options";
import { DataTable, EmptyRow, PageHeader, td, th } from "./admin-bits";

export const metadata: Metadata = { title: { absolute: "Pano | Yönetim" } };

export default async function AdminHomePage() {
  const { token, user } = await getAdminContext();
  const [summary, pending, latest] = await Promise.all([
    apiFetch<AdminSummary>("/admin/summary", { token }),
    apiFetch<Paginated<AdminCompany>>("/admin/companies?status=PENDING&limit=5", { token }),
    apiFetch<Paginated<AdminRequest>>("/admin/requests?limit=8", { token }),
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
      <PageHeader title="Pano" description={`Hoş geldin ${user.fullName.split(" ")[0]}. Bekleyen işler ve genel durum.`} />
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <li key={s.label}>
            <Link
              href={s.href}
              className={`block h-full rounded-xl border bg-white p-4 shadow-sm hover:border-brand-300 ${
                s.highlight ? "border-accent-300 ring-1 ring-accent-300" : "border-slate-200"
              }`}
            >
              <p className={`text-2xl font-bold tabular-nums ${s.highlight ? "text-accent-800" : "text-slate-900"}`}>{s.value}</p>
              <p className="mt-1 text-sm text-slate-600">{s.label}</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 grid gap-6 2xl:grid-cols-2">
        <section aria-labelledby="bekleyen">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 id="bekleyen" className="font-semibold text-slate-900">Onay bekleyen firmalar</h2>
            <Link href="/yonetim/firmalar" className="text-sm font-medium text-brand-700 hover:underline">
              Tümü ({pending.total})
            </Link>
          </div>
          <DataTable label="Onay bekleyen firmalar, en eski başvuru önce">
            <thead>
              <tr>
                <th scope="col" className={th}>Firma</th>
                <th scope="col" className={th}>Merkez</th>
                <th scope="col" className={th}>Yetkili</th>
                <th scope="col" className={th}>K3</th>
                <th scope="col" className={th}>Başvuru</th>
              </tr>
            </thead>
            <tbody>
              {pending.items.length === 0 && <EmptyRow colSpan={5}>Bekleyen başvuru yok.</EmptyRow>}
              {pending.items.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className={td}>
                    <Link href={`/yonetim/firmalar/${c.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                      {c.displayName}
                    </Link>
                  </td>
                  <td className={td}>{c.cityName}</td>
                  <td className={td}>
                    {c.owner.fullName}
                    <div className="text-xs text-slate-500">{formatPhone(c.owner.phone)}</div>
                  </td>
                  <td className={td}>{c.k3LicenseNumber ? "Var" : <span className="text-accent-800">Yok</span>}</td>
                  <td className={`${td} whitespace-nowrap text-slate-600`}>{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </section>

        <section aria-labelledby="son-talepler">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 id="son-talepler" className="font-semibold text-slate-900">Son talepler</h2>
            <Link href="/yonetim/talepler" className="text-sm font-medium text-brand-700 hover:underline">
              Tümü ({latest.total})
            </Link>
          </div>
          <DataTable label="Son açılan talepler">
            <thead>
              <tr>
                <th scope="col" className={th}>Güzergâh</th>
                <th scope="col" className={th}>Müşteri</th>
                <th scope="col" className={th}>Teklif</th>
                <th scope="col" className={th}>Durum</th>
                <th scope="col" className={th}>Açıldı</th>
              </tr>
            </thead>
            <tbody>
              {latest.items.length === 0 && <EmptyRow colSpan={5}>Henüz talep yok.</EmptyRow>}
              {latest.items.map((r) => {
                const status = REQUEST_STATUS[r.status];
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className={td}>
                      <Link href={`/yonetim/talepler/${r.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                        {place(r.fromCityName, r.fromDistrictName)} → {place(r.toCityName, r.toDistrictName)}
                      </Link>
                    </td>
                    <td className={td}>{r.customer.fullName}</td>
                    <td className={`${td} tabular-nums`}>{r.quoteCount}</td>
                    <td className={td}>
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className={`${td} whitespace-nowrap text-slate-600`}>{formatDate(r.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </section>
      </div>
    </>
  );
}
