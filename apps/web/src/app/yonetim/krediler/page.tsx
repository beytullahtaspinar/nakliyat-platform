import type { Metadata } from "next";
import Link from "next/link";
import { CreditTable } from "@/components/credits/credit-table";
import { StatGrid } from "@/components/panel/panel-bits";
import { getAdminContext, oneParam, pageParam } from "@/lib/admin";
import { apiFetch, type Paginated } from "@/lib/api";
import { CREDIT_FILTERS, formatCredits, type CreditOverview, type CreditTransaction } from "@/lib/credits";
import { formatMoney } from "@/lib/format";
import { FilterTabs, PageHeader, Pager, SearchForm, query } from "../admin-bits";

export const metadata: Metadata = { title: { absolute: "Krediler | Yönetim" } };

const LIMIT = 30;
const MONTHS = new Intl.DateTimeFormat("tr-TR", { month: "long", timeZone: "Europe/Istanbul" });

/** Kredi panosu ve tüm hareketler; firma, tür ve firma adıyla süzülür */
export default async function AdminCreditsPage({ searchParams }: PageProps<"/yonetim/krediler">) {
  const { token } = await getAdminContext();
  const params = await searchParams;
  const filter = CREDIT_FILTERS.find((f) => f.value === oneParam(params.tur)) ?? CREDIT_FILTERS[0];
  const q = oneParam(params.ara)?.trim() || undefined;
  const companyId = oneParam(params.firma) || undefined;
  const page = pageParam(params.sayfa);
  const [overview, { items, total }] = await Promise.all([
    apiFetch<CreditOverview>("/admin/credits/overview", { token }),
    apiFetch<Paginated<CreditTransaction>>(
      `/admin/credits/transactions${query({ type: filter.type, q, companyId, page, limit: LIMIT })}`,
      { token },
    ),
  ]);
  const href = (tur: string, sayfa = 1) =>
    `/yonetim/krediler${query({ tur: tur === "tumu" ? undefined : tur, ara: q, firma: companyId, sayfa })}`;

  const m = overview.month;
  const spent = -(m.QUOTE.amount + m.QUOTE_REFUND.amount);
  const toTry = (credits: number) => formatMoney(credits * overview.creditValueTry);
  const month = MONTHS.format(new Date(overview.monthStart));

  return (
    <>
      <PageHeader
        title="Krediler"
        description={
          overview.enabled ? (
            <>Kredi sistemi <strong className="text-green-800">açık</strong>: firmalar teklif verirken kredi kullanıyor.</>
          ) : (
            <>Kredi sistemi <strong>kapalı</strong>: teklif vermek ücretsiz. Açmak için ayarlara git.</>
          )
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/yonetim/krediler/kart-odemeleri"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-50"
            >
              Kart ödemeleri
            </Link>
            <Link
              href="/yonetim/krediler/havaleler"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-50"
            >
              Havale bildirimleri{overview.transfersPending > 0 && ` (${overview.transfersPending} bekliyor)`}
            </Link>
            <Link href="/yonetim/krediler/ayarlar" className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800">
              Kredi ayarları
            </Link>
          </div>
        }
      />

      <StatGrid
        className="mb-6"
        stats={[
          {
            label: "Firmalardaki toplam bakiye",
            value: formatCredits(overview.totalBalance),
            hint: `${overview.companiesWithBalance} firma · yaklaşık ${toTry(overview.totalBalance)}`,
            href: "/yonetim/firmalar",
          },
          {
            label: `${month} ayında satılan`,
            value: formatCredits(m.CARD_TOPUP.amount + m.TRANSFER_TOPUP.amount),
            hint: `${m.CARD_TOPUP.count} kart, ${m.TRANSFER_TOPUP.count} havale${overview.transfersPending > 0 ? ` · ${overview.transfersPending} havale onay bekliyor` : ""}`,
            href: "/yonetim/krediler/kart-odemeleri?durum=basarili",
          },
          { label: `${month} ayında harcanan`, value: formatCredits(spent), hint: `${m.QUOTE.count} teklif, ${m.QUOTE_REFUND.count} iade`, href: href("teklif") },
          {
            label: `${month} ayında yönetimin eklediği`,
            value: formatCredits(m.ADMIN_CREDIT.amount + m.WELCOME.amount),
            hint: `${m.WELCOME.count} hoş geldin dahil · ${formatCredits(-m.ADMIN_DEBIT.amount)} düşüldü`,
            href: href("eklenen"),
          },
        ]}
      />

      <h2 className="mb-3 text-base font-semibold text-slate-900">Hareketler</h2>
      <div className="mb-4 flex flex-col gap-3">
        <SearchForm action="/yonetim/krediler" q={q} placeholder="Firma adında ara" keep={{ tur: filter.value === "tumu" ? undefined : filter.value }} />
        <FilterTabs
          label="Hareket türü"
          current={filter.value}
          options={CREDIT_FILTERS.map((f) => ({ value: f.value, label: f.label, href: href(f.value) }))}
        />
        {companyId && (
          <p className="text-sm text-slate-600">
            Tek firmanın hareketleri gösteriliyor.{" "}
            <Link href={`/yonetim/krediler${query({ tur: filter.value === "tumu" ? undefined : filter.value })}`} className="font-medium text-brand-700 hover:underline">
              Tüm firmalar
            </Link>
          </p>
        )}
      </div>
      <CreditTable admin items={items} empty={q || companyId || filter.type ? "Bu süzgece uyan hareket yok." : "Henüz kredi hareketi yok."} />
      <Pager page={page} limit={LIMIT} total={total} href={(p) => href(filter.value, p)} />
    </>
  );
}
