import type { Metadata } from "next";
import Link from "next/link";
import { ActionsMenu, type RowAction } from "@/components/panel/actions-menu";
import { DataTable, EmptyRow, FilterTabs, PageHeader, Pager, SearchForm, query, td, th } from "@/components/panel/panel-bits";
import { Badge } from "@/components/ui/card";
import { apiFetch, type CompanyBooking, type Paginated, type UnreadMessages } from "@/lib/api";
import { getCompanyContext } from "@/lib/company";
import { formatDate, formatMoney, formatPhone } from "@/lib/format";
import { googleDirectionsUrl } from "@/lib/geo";
import { oneParam, pageParam } from "@/lib/params";
import { homeTypeLabel } from "@/lib/request-options";
import { BookingStatusBadge, bookingRoute } from "../booking-bits";

export const metadata: Metadata = { title: "İşlerim" };

const FILTERS: { value: string; label: string; status?: CompanyBooking["status"] }[] = [
  { value: "tumu", label: "Tümü" },
  { value: "planli", label: "Planlanan", status: "SCHEDULED" },
  { value: "tamamlanan", label: "Tamamlanan", status: "COMPLETED" },
  { value: "iptal", label: "İptal edilen", status: "CANCELLED" },
];
const LIMIT = 25;

type Stop = CompanyBooking["request"]["from"];
/** Yol tarifi için: işaret varsa koordinat, yoksa yazılı adres */
const directionsStop = (s: Stop) => ({
  location: s.location,
  text: [s.address, s.districtName, s.cityName].filter(Boolean).join(", "),
});

/** Anlaşılan işler: müşteri, güzergâh, tutar, durum ve mesajlar. İş tamamlama/iptal ayrıntı sayfasında. */
export default async function CompanyBookingsPage({ searchParams }: PageProps<"/firma-paneli/isler">) {
  const { token, profile } = await getCompanyContext();
  if (!profile) return null;
  const params = await searchParams;
  const q = oneParam(params.ara)?.trim().slice(0, 100) || undefined;
  const filter = FILTERS.find((f) => f.value === oneParam(params.durum)) ?? FILTERS[0];
  const page = pageParam(params.sayfa);
  const [{ items, total }, unread] = await Promise.all([
    apiFetch<Paginated<CompanyBooking>>(`/company/bookings${query({ status: filter.status, q, page, limit: LIMIT })}`, { token }),
    apiFetch<UnreadMessages>("/messages/unread", { token }).catch(() => null),
  ]);
  const unreadFor = (bookingId: string) => unread?.items.find((u) => u.bookingId === bookingId)?.count ?? 0;
  const href = (durum: string, sayfa = 1) =>
    `/firma-paneli/isler${query({ durum: durum === "tumu" ? undefined : durum, ara: q, sayfa })}`;

  const actions = (b: CompanyBooking): RowAction[] => [
    { label: "Ayrıntılar ve mesajlar", href: `/firma-paneli/isler/${b.id}` },
    { label: "Müşteriyi ara", href: `tel:${b.customer.phone}` },
    ...(b.status === "SCHEDULED"
      ? [{ label: "Yol tarifi al", href: googleDirectionsUrl(directionsStop(b.request.from), directionsStop(b.request.to)), external: true }]
      : []),
    ...(b.review && !b.review.companyReply ? [{ label: "Yorumu yanıtla", href: `/firma-paneli/isler/${b.id}#degerlendirme` }] : []),
    { label: "Müşterinin diğer işleri", href: `/firma-paneli/isler?ara=${encodeURIComponent(formatPhone(b.customer.phone))}` },
  ];

  return (
    <>
      <PageHeader
        title="İşlerim"
        description="Teklifin kabul edilen işler. Müşterinin iletişim bilgileri ve açık adresi burada; işi tamamlama ve iptal ayrıntı sayfasında."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label="İş durumu"
          current={filter.value}
          options={FILTERS.map((f) => ({ value: f.value, label: f.label, href: href(f.value) }))}
        />
        <SearchForm action="/firma-paneli/isler" q={q} placeholder="Müşteri adı ya da telefonu" keep={{ durum: oneParam(params.durum) }} />
      </div>

      <DataTable label="İşlerim" minWidth={860}>
        <thead>
          <tr>
            <th scope="col" className={th}>Taşınma</th>
            <th scope="col" className={th}>Müşteri</th>
            <th scope="col" className={th}>Güzergâh</th>
            <th scope="col" className={th}>Tutar</th>
            <th scope="col" className={th}>Durum</th>
            <th scope="col" className={th}>Mesajlar</th>
            <th scope="col" className={th}><span className="sr-only">İşlemler</span></th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <EmptyRow colSpan={7}>
              {filter.value === "tumu" && !q
                ? "Henüz kabul edilen teklifin yok. Bir müşteri teklifini kabul ettiğinde iş burada, müşterinin iletişim bilgileriyle birlikte görünür."
                : "Bu süzgece uyan iş yok."}
            </EmptyRow>
          )}
          {items.map((b) => {
            const unreadCount = unreadFor(b.id);
            return (
              <tr key={b.id} className="hover:bg-slate-50">
                <td className={`${td} whitespace-nowrap`}>
                  <Link href={`/firma-paneli/isler/${b.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                    {formatDate(b.scheduledAt)}
                  </Link>
                  <div className="text-xs text-slate-500">{homeTypeLabel(b.request.homeType)}</div>
                </td>
                <td className={td}>
                  {b.customer.fullName}
                  <div>
                    <a href={`tel:${b.customer.phone}`} className="text-xs font-medium whitespace-nowrap text-brand-700 hover:underline">
                      {formatPhone(b.customer.phone)}
                    </a>
                  </div>
                </td>
                <td className={td}>{bookingRoute(b.request.from, b.request.to)}</td>
                <td className={`${td} whitespace-nowrap tabular-nums`}>{formatMoney(b.priceTry)}</td>
                <td className={td}>
                  <BookingStatusBadge status={b.status} />
                  {b.status === "CANCELLED" && b.cancelReason && (
                    <p className="mt-1 max-w-56 text-xs text-slate-600">{b.cancelReason}</p>
                  )}
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  <Link href={`/firma-paneli/isler/${b.id}`} className="font-medium text-brand-700 hover:underline">
                    Müşteriyle mesajlaş
                  </Link>
                  {unreadCount > 0 && (
                    <Badge tone="accent" className="ml-2">
                      {unreadCount} yeni mesaj
                    </Badge>
                  )}
                </td>
                <td className={`${td} text-right`}>
                  <ActionsMenu label={`İşlemler: ${b.customer.fullName}, ${formatDate(b.scheduledAt)}`} actions={actions(b)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
      <Pager page={page} limit={LIMIT} total={total} href={(p) => href(filter.value, p)} />
    </>
  );
}
