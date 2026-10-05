import type { Metadata } from "next";
import Link from "next/link";
import { CompanyBadges } from "@/components/company-badges";
import { DataTable, EmptyRow, PageHeader, StatGrid, TableHeading, td, th, type Stat } from "@/components/panel/panel-bits";
import { ButtonLink } from "@/components/ui/button";
import {
  apiFetch,
  type BadgeProgress,
  type CompanyBooking,
  type CompanyOverview,
  type CompanyRequest,
  type Paginated,
} from "@/lib/api";
import { BADGE_KEYS, BADGE_ORDER } from "@/lib/badges";
import { getCompanyContext } from "@/lib/company";
import { formatDate, formatMoney, formatPhone, place } from "@/lib/format";
import { homeTypeLabel } from "@/lib/request-options";
import { route } from "./request-bits";

export const metadata: Metadata = { title: { absolute: "Pano | Firma paneli" } };

const percent = (ratio: number | null) => (ratio === null ? "—" : `%${Math.round(ratio * 100)}`);
const monthName = (month: string) =>
  new Intl.DateTimeFormat("tr-TR", { month: "long", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));

/** Firma panosu: bekleyen işler, özet sayılar, yeni talepler ve yaklaşan işler */
export default async function CompanyDashboardPage() {
  const { token, profile, user } = await getCompanyContext();
  if (!profile) return null;
  const [overview, fresh, upcoming, badges] = await Promise.all([
    apiFetch<CompanyOverview>("/company/overview", { token }),
    apiFetch<Paginated<CompanyRequest>>("/company/requests?quoted=no&limit=5", { token }),
    apiFetch<Paginated<CompanyBooking>>("/company/bookings?status=SCHEDULED&limit=5", { token }),
    apiFetch<BadgeProgress>("/company/profile/badges", { token }).catch(() => null),
  ]);
  const earned = badges ? BADGE_ORDER.filter((code) => badges[BADGE_KEYS[code]].earned) : [];
  const { requests, quotes, bookings, revenue, rating } = overview;

  const stats: Stat[] = [
    {
      label: "Teklif bekleyen talep",
      value: requests.notQuoted,
      href: "/firma-paneli/talepler?durum=yeni",
      hint: `Bölgende ${requests.open} açık talep`,
      highlight: requests.notQuoted > 0,
    },
    { label: "Bekleyen teklifin", value: quotes.pending, href: "/firma-paneli/teklifler?durum=bekleyen" },
    { label: "Önümüzdeki 7 gün", value: bookings.next7Days, href: "/firma-paneli/takvim?gorunum=hafta", hint: "planlı taşıma" },
    { label: "Planlanmış iş", value: bookings.scheduled, href: "/firma-paneli/isler?durum=planli" },
    {
      label: `${monthName(revenue.month)} cirosu`,
      value: formatMoney(revenue.thisMonthTry),
      href: "/firma-paneli/isler",
      hint: `Geçen ay ${formatMoney(revenue.lastMonthTry)}`,
    },
    { label: "Kazanma oranı", value: percent(quotes.winRate), href: "/firma-paneli/teklifler", hint: "son 90 gün" },
    { label: "Tamamlanan iş", value: bookings.completed, href: "/firma-paneli/isler?durum=tamamlanan" },
    {
      label: "Müşteri puanı",
      value: rating.count > 0 ? rating.average.toLocaleString("tr-TR", { maximumFractionDigits: 1 }) : "—",
      href: "/firma-paneli/degerlendirmeler",
      hint: `${rating.count} değerlendirme`,
    },
  ];

  return (
    <>
      <PageHeader
        title="Pano"
        description={`Hoş geldin ${user.fullName.split(" ")[0]}. Bekleyen işlerin ve genel durum.`}
        actions={
          earned.length > 0 && (
            <Link href="/firma-paneli/degerlendirmeler#rozetler" className="block w-fit" aria-label="Rozetlerin">
              <CompanyBadges badges={earned} />
            </Link>
          )
        }
      />
      <StatGrid stats={stats} />

      <div className="mt-8 grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <section aria-labelledby="yeni-talepler">
          <TableHeading
            id="yeni-talepler"
            title="Teklif vermediğin talepler"
            href="/firma-paneli/talepler?durum=yeni"
            linkLabel={`Tümü (${fresh.total})`}
          />
          <DataTable label="Teklif vermediğin talepler, taşınma tarihi yakın olan önce" minWidth={560}>
            <thead>
              <tr>
                <th scope="col" className={th}>Güzergâh</th>
                <th scope="col" className={th}>Taşınma</th>
                <th scope="col" className={th}>Teklif</th>
                <th scope="col" className={th}>Son gün</th>
                <th scope="col" className={th}><span className="sr-only">İşlem</span></th>
              </tr>
            </thead>
            <tbody>
              {fresh.items.length === 0 && (
                <EmptyRow colSpan={5}>
                  Teklif bekleyen talep yok.{" "}
                  <Link href="/firma-paneli/profil" className="font-medium text-brand-700 hover:underline">
                    Hizmet illerini genişlet
                  </Link>
                </EmptyRow>
              )}
              {fresh.items.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className={td}>
                    <Link href={`/firma-paneli/talepler/${r.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                      {route(r)}
                    </Link>
                    <div className="text-xs text-slate-500">{homeTypeLabel(r.homeType)}</div>
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{formatDate(r.moveDate)}</td>
                  <td className={`${td} tabular-nums`}>{r.quoteCount}</td>
                  <td className={`${td} whitespace-nowrap text-slate-600`}>{formatDate(r.expiresAt)}</td>
                  <td className={`${td} text-right`}>
                    <ButtonLink href={`/firma-paneli/talepler/${r.id}`} size="sm">
                      Teklif ver
                    </ButtonLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </section>

        <section aria-labelledby="yaklasan-isler">
          <TableHeading id="yaklasan-isler" title="Yaklaşan işler" href="/firma-paneli/isler?durum=planli" linkLabel={`Tümü (${upcoming.total})`} />
          <DataTable label="Yaklaşan işler, taşınma tarihi yakın olan önce" minWidth={560}>
            <thead>
              <tr>
                <th scope="col" className={th}>Taşınma</th>
                <th scope="col" className={th}>Müşteri</th>
                <th scope="col" className={th}>Güzergâh</th>
                <th scope="col" className={th}>Tutar</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.items.length === 0 && <EmptyRow colSpan={4}>Planlanmış iş yok.</EmptyRow>}
              {upcoming.items.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className={`${td} whitespace-nowrap`}>
                    <Link href={`/firma-paneli/isler/${b.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                      {formatDate(b.scheduledAt)}
                    </Link>
                  </td>
                  <td className={td}>
                    {b.customer.fullName}
                    <div className="text-xs text-slate-500">{formatPhone(b.customer.phone)}</div>
                  </td>
                  <td className={td}>
                    {place(b.request.from.cityName, b.request.from.districtName)} → {place(b.request.to.cityName, b.request.to.districtName)}
                  </td>
                  <td className={`${td} whitespace-nowrap tabular-nums`}>{formatMoney(b.priceTry)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </section>
      </div>
    </>
  );
}
