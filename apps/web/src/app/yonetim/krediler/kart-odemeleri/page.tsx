import type { Metadata } from "next";
import Link from "next/link";
import { StatGrid } from "@/components/panel/panel-bits";
import { Badge } from "@/components/ui/card";
import { getAdminContext, oneParam, pageParam } from "@/lib/admin";
import { apiFetch } from "@/lib/api";
import { CARD_FILTERS, CARD_STATUS, formatCredits, formatTryExact, type AdminCardPaymentList } from "@/lib/credits";
import { formatDateTime } from "@/lib/format";
import { DataTable, EmptyRow, FilterTabs, PageHeader, Pager, SearchForm, query, td, th } from "../../admin-bits";

export const metadata: Metadata = { title: { absolute: "Kart ödemeleri | Yönetim" } };

const LIMIT = 30;

/** iyzico kart ödemeleri: başarılı, başarısız ve yarım kalanlar. Para iadesi iyzico panelinden yapılır. */
export default async function AdminCardPaymentsPage({ searchParams }: PageProps<"/yonetim/krediler/kart-odemeleri">) {
  const { token } = await getAdminContext();
  const params = await searchParams;
  const q = oneParam(params.ara)?.trim().slice(0, 100) || undefined;
  const filter = CARD_FILTERS.find((f) => f.value === oneParam(params.durum)) ?? CARD_FILTERS[0];
  const page = pageParam(params.sayfa);
  const list = await apiFetch<AdminCardPaymentList>(`/admin/credits/card-payments${query({ status: filter.status, q, page, limit: LIMIT })}`, { token });
  const href = (durum: string, sayfa = 1) =>
    `/yonetim/krediler/kart-odemeleri${query({ durum: durum === "tumu" ? undefined : durum, ara: q, sayfa })}`;

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/krediler", label: "Krediler" }}
        title="Kart ödemeleri"
        description={
          <>
            iyzico ile alınan ödemeler. Para iadesi iyzico panelinden yapılır; ardından kredisi firma kaydından elle düşülür.
            {!list.configured && (
              <>
                {" "}
                <strong>iyzico anahtarları sunucuda tanımlı değil.</strong>
              </>
            )}
            {list.configured && list.sandbox && (
              <>
                {" "}
                <strong>Deneme ortamı (sandbox): ödemeler gerçek para değildir.</strong>
              </>
            )}{" "}
            <Link href="/yonetim/krediler/ayarlar#kart" className="font-medium text-brand-700 hover:underline">
              Kart ayarı
            </Link>
          </>
        }
      />
      <StatGrid
        className="mb-6"
        stats={[
          { label: "Son 30 gün tahsilat", value: formatTryExact(list.last30Days.amountTry), hint: `${list.last30Days.count} başarılı ödeme`, href: href("basarili") },
          { label: "Son 30 gün yüklenen", value: formatCredits(list.last30Days.credits), hint: "Deneme ödemeleri hariç", href: href("basarili") },
        ]}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs label="Ödeme durumu" current={filter.value} options={CARD_FILTERS.map((f) => ({ value: f.value, label: f.label, href: href(f.value) }))} />
        <SearchForm action="/yonetim/krediler/kart-odemeleri" q={q} placeholder="Firma adında ara" keep={{ durum: oneParam(params.durum) }} />
      </div>

      <DataTable label="Kart ödemeleri, en yenisi önce" minWidth={760}>
        <thead>
          <tr>
            <th scope="col" className={th}>Tarih</th>
            <th scope="col" className={th}>Firma</th>
            <th scope="col" className={th}>Tutar</th>
            <th scope="col" className={th}>Durum</th>
            <th scope="col" className={th}>iyzico no</th>
          </tr>
        </thead>
        <tbody>
          {list.items.length === 0 && <EmptyRow colSpan={5}>{q || filter.status ? "Bu süzgece uyan ödeme yok." : "Henüz kart ödemesi yok."}</EmptyRow>}
          {list.items.map((p) => {
            const status = CARD_STATUS[p.status];
            return (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className={`${td} whitespace-nowrap text-slate-600`}>{formatDateTime(p.createdAt)}</td>
                <td className={td}>
                  <Link href={`/yonetim/firmalar/${p.company.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                    {p.company.displayName}
                  </Link>
                  {p.user && <div className="text-xs text-slate-500">{p.user.fullName}</div>}
                </td>
                <td className={`${td} whitespace-nowrap tabular-nums`}>
                  <div className="font-semibold text-slate-900">{formatTryExact(p.amountTry)}</div>
                  <div className="text-xs text-slate-600">{formatCredits(p.credits)}</div>
                </td>
                <td className={td}>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {p.sandbox && <Badge tone="neutral">Deneme</Badge>}
                  </div>
                  {p.errorMessage && <div className="mt-1 text-xs text-slate-600">{p.errorMessage}</div>}
                </td>
                <td className={`${td} font-mono text-xs text-slate-600`}>{p.providerPaymentId ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
      <Pager page={page} limit={LIMIT} total={list.total} href={(p) => href(filter.value, p)} />
    </>
  );
}
