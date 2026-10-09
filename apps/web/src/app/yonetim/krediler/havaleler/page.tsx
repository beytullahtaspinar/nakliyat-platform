import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/card";
import { getAdminContext, oneParam, pageParam } from "@/lib/admin";
import { apiFetch } from "@/lib/api";
import { TRANSFER_FILTERS, TRANSFER_STATUS, formatCredits, formatTryExact, type AdminBankTransferList, type CreditSettings } from "@/lib/credits";
import { formatDate, formatDateTime } from "@/lib/format";
import { DataTable, EmptyRow, FilterTabs, PageHeader, Pager, SearchForm, query, td, th } from "../../admin-bits";
import { TransferReview } from "./transfer-review";

export const metadata: Metadata = { title: { absolute: "Havale bildirimleri | Yönetim" } };

const LIMIT = 25;

/**
 * Firmaların "havale yaptım" bildirimleri. Varsayılan liste onay bekleyenler (en eski önce):
 * banka hesabında tutar ve açıklama kodu görülünce onaylanır, kredi o anda yüklenir.
 */
export default async function AdminTransfersPage({ searchParams }: PageProps<"/yonetim/krediler/havaleler">) {
  const { token } = await getAdminContext();
  const params = await searchParams;
  const q = oneParam(params.ara)?.trim().slice(0, 100) || undefined;
  const filter = TRANSFER_FILTERS.find((f) => f.value === oneParam(params.durum)) ?? (q ? TRANSFER_FILTERS[4] : TRANSFER_FILTERS[0]);
  const page = pageParam(params.sayfa);
  const [list, settings] = await Promise.all([
    apiFetch<AdminBankTransferList>(`/admin/credits/transfers${query({ status: filter.status, q, page, limit: LIMIT })}`, { token }),
    apiFetch<{ settings: CreditSettings }>("/admin/credits/settings", { token }),
  ]);
  const bankOf = (iban: string) => settings.settings.bankAccounts.find((a) => a.iban === iban.replace(/\s+/g, ""))?.bank;
  const href = (durum: string, sayfa = 1) =>
    `/yonetim/krediler/havaleler${query({ durum: durum === "bekleyen" && !q ? undefined : durum, ara: q, sayfa })}`;

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/krediler", label: "Krediler" }}
        title="Havale bildirimleri"
        description={
          <>
            Banka hesabında tutarı ve açıklamadaki firma kodunu görünce onayla; kredi onay anındaki değerle (1 kredi{" "}
            {list.creditValueTry.toLocaleString("tr-TR")} TL) yüklenir.
            {settings.settings.bankAccounts.length === 0 && (
              <>
                {" "}
                <strong>Banka hesabı tanımlı değil; firmalar havale bildiremez.</strong>{" "}
                <Link href="/yonetim/krediler/ayarlar#banka-hesaplari" className="font-medium text-brand-700 hover:underline">
                  Hesap ekle
                </Link>
              </>
            )}
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label="Bildirim durumu"
          current={filter.value}
          options={TRANSFER_FILTERS.map((f) => ({
            value: f.value,
            label: f.status === "PENDING" && list.pending > 0 ? `${f.label} (${list.pending})` : f.label,
            href: href(f.value),
          }))}
        />
        <SearchForm
          action="/yonetim/krediler/havaleler"
          q={q}
          placeholder="Firma, havale kodu ya da gönderen"
          keep={{ durum: oneParam(params.durum) }}
        />
      </div>

      <DataTable label={filter.status === "PENDING" ? "Onay bekleyen havale bildirimleri, en eski önce" : "Havale bildirimleri"} minWidth={880}>
        <thead>
          <tr>
            <th scope="col" className={th}>Firma</th>
            <th scope="col" className={th}>Tutar</th>
            <th scope="col" className={th}>Havale</th>
            <th scope="col" className={th}>Durum</th>
            <th scope="col" className={th}>
              <span className="sr-only">İşlem</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {list.items.length === 0 && (
            <EmptyRow colSpan={5}>{filter.status === "PENDING" ? "Onay bekleyen havale bildirimi yok." : "Bu süzgece uyan bildirim yok."}</EmptyRow>
          )}
          {list.items.map((t) => {
            const status = TRANSFER_STATUS[t.status];
            return (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className={td}>
                  <Link href={`/yonetim/firmalar/${t.company.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                    {t.company.displayName}
                  </Link>
                  {t.transferCode && <div className="font-mono text-sm font-semibold text-brand-800">{t.transferCode}</div>}
                  <div className="text-xs text-slate-500">Bakiye: {formatCredits(t.company.balance)}</div>
                </td>
                <td className={`${td} whitespace-nowrap tabular-nums`}>
                  <div className="font-semibold text-slate-900">{formatTryExact(t.approvedAmountTry ?? t.amountTry)}</div>
                  {t.approvedAmountTry && t.approvedAmountTry !== t.amountTry && (
                    <div className="text-xs text-slate-500">Bildirilen: {formatTryExact(t.amountTry)}</div>
                  )}
                  {t.credits !== null ? (
                    <div className="text-xs font-medium text-green-800">+{formatCredits(t.credits)}</div>
                  ) : (
                    t.expectedCredits !== null && <div className="text-xs text-slate-600">≈ {formatCredits(t.expectedCredits)}</div>
                  )}
                </td>
                <td className={td}>
                  <div className="text-slate-900">{t.senderName}</div>
                  <div className="text-xs text-slate-600">
                    {formatDate(t.transferDate)} · {bankOf(t.iban) ?? t.iban}
                  </div>
                  {t.note && <div className="mt-1 text-xs text-slate-600">Not: {t.note}</div>}
                  {t.receipt ? (
                    <a href={t.receipt.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-medium break-all text-brand-700 hover:underline">
                      Dekont: {t.receipt.fileName}
                    </a>
                  ) : (
                    <div className="mt-1 text-xs text-slate-500">Dekont eklenmedi</div>
                  )}
                </td>
                <td className={td}>
                  <Badge tone={status.tone}>{status.label}</Badge>
                  <div className="mt-1 text-xs text-slate-500">Bildirildi: {formatDateTime(t.createdAt)}</div>
                  {t.reviewedBy && t.reviewedAt && (
                    <div className="text-xs text-slate-500">
                      {t.reviewedBy.fullName} · {formatDateTime(t.reviewedAt)}
                    </div>
                  )}
                  {t.rejectReason && <div className="mt-1 text-xs text-slate-600">Gerekçe: {t.rejectReason}</div>}
                </td>
                <td className={td}>
                  {t.status === "PENDING" && (
                    <TransferReview transferId={t.id} companyName={t.company.displayName} amountTry={t.amountTry} creditValueTry={list.creditValueTry} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
      <Pager page={page} limit={LIMIT} total={list.total} href={(p) => href(filter.value, p)} />
    </>
  );
}
