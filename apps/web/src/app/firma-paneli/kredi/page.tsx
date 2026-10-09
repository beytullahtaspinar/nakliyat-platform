import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton } from "@/components/credits/copy-button";
import { CreditTable } from "@/components/credits/credit-table";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { DataTable, FilterTabs, PageHeader, Pager, PanelSection, query, td, th } from "@/components/panel/panel-bits";
import { Badge } from "@/components/ui/card";
import { cancelTransfer } from "@/lib/actions/credits";
import { apiFetch, type Paginated } from "@/lib/api";
import { getCompanyContext } from "@/lib/company";
import {
  CREDIT_FILTERS,
  TRANSFER_STATUS,
  formatCredits,
  formatIban,
  formatTryExact,
  type BankTransfer,
  type CompanyCreditSummary,
  type CreditTransaction,
} from "@/lib/credits";
import { formatDate } from "@/lib/format";
import { COMPANY } from "@/lib/legal";
import { oneParam, pageParam } from "@/lib/params";
import { TransferForm } from "./transfer-form";

export const metadata: Metadata = { title: "Kredi" };

const LIMIT = 25;

/** Kredi bakiyesi, teklif başına kredi ve hareketler */
export default async function CompanyCreditsPage({ searchParams }: PageProps<"/firma-paneli/kredi">) {
  const { token, profile } = await getCompanyContext();
  if (!profile) return null;
  const params = await searchParams;
  const filter = CREDIT_FILTERS.find((f) => f.value === oneParam(params.tur)) ?? CREDIT_FILTERS[0];
  const page = pageParam(params.sayfa);
  const [summary, { items, total }, transfers] = await Promise.all([
    apiFetch<CompanyCreditSummary>("/company/credits", { token }),
    apiFetch<Paginated<CreditTransaction>>(`/company/credits/transactions${query({ type: filter.type, page, limit: LIMIT })}`, { token }),
    apiFetch<Paginated<BankTransfer>>("/company/credits/transfers?limit=10", { token }),
  ]);
  const href = (tur: string, sayfa = 1) => `/firma-paneli/kredi${query({ tur: tur === "tumu" ? undefined : tur, sayfa })}`;
  const low = summary.enabled && summary.balance < summary.lowBalanceThreshold;

  const facts = [
    {
      label: "Bakiye",
      value: formatCredits(summary.balance),
      hint: low ? "Bakiyen azaldı" : summary.enabled ? `${Math.floor(summary.balance / Math.max(summary.quoteCostLocal, 1))} şehir içi teklife yeter` : null,
      warn: low,
    },
    { label: "Şehir içi teklif", value: formatCredits(summary.quoteCostLocal), hint: "Aynı il içindeki talep" },
    { label: "Şehirler arası teklif", value: formatCredits(summary.quoteCostIntercity), hint: "İller arası talep" },
  ];

  return (
    <>
      <PageHeader title="Kredi" description="Taleplere teklif verirken kredi kullanılır. Teklifi güncellemek ücretsizdir." />

      {!summary.enabled && (
        <p role="status" className="mb-5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <strong>Teklif vermek şu an ücretsiz.</strong> Kredi sistemi açıldığında her teklifte aşağıdaki kredi düşecek; bunu önceden
          duyuracağız.
        </p>
      )}

      <dl className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {facts.map((f) => (
          <div
            key={f.label}
            className={`rounded-xl border bg-white p-4 shadow-sm ${f.warn ? "border-amber-300 ring-1 ring-amber-300" : "border-slate-200"}`}
          >
            <dt className="text-xs font-semibold tracking-wide text-slate-600 uppercase">{f.label}</dt>
            <dd className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{f.value}</dd>
            {f.hint && <dd className={`mt-0.5 text-sm ${f.warn ? "font-medium text-amber-900" : "text-slate-600"}`}>{f.hint}</dd>}
          </div>
        ))}
      </dl>

      {summary.transfer ? (
        <PanelSection
          id="yukleme"
          title="Havale/EFT ile kredi yükle"
          description="Ödemeyi aşağıdaki hesaba gönder, sonra bu formla bildir. Hesabımıza geçtiğini görünce kredin yüklenir ve sana haber veririz."
          className="mb-6"
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="space-y-4">
              <div className="rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 p-4">
                <p className="text-sm font-medium text-brand-900">Açıklama kısmına bu kodu yaz</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="font-mono text-2xl font-bold tracking-wider text-slate-900">{summary.transfer.code}</p>
                  <CopyButton value={summary.transfer.code} label="Havale kodunu" />
                </div>
                <p className="mt-1 text-xs text-brand-900">Kod, ödemenin firmana ait olduğunu anlamamızı sağlar.</p>
              </div>
              <ul className="space-y-3" aria-label="Banka hesapları">
                {summary.transfer.bankAccounts.map((a) => (
                  <li key={a.iban} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{a.bank}</p>
                        <p className="text-sm text-slate-600">{a.holder}</p>
                      </div>
                      <CopyButton value={a.iban} label={`${a.bank} IBAN'ını`} />
                    </div>
                    <p className="mt-2 font-mono text-sm break-words text-slate-900">{formatIban(a.iban)}</p>
                  </li>
                ))}
              </ul>
            </div>
            <TransferForm
              accounts={summary.transfer.bankAccounts}
              minTopupTry={summary.transfer.minTopupTry}
              creditValueTry={summary.creditValueTry}
              defaultSender={profile.legalName}
            />
          </div>
        </PanelSection>
      ) : null}

      {transfers.items.length > 0 && (
        <section aria-labelledby="havaleler-baslik" className="mb-6">
          <h2 id="havaleler-baslik" className="mb-3 text-base font-semibold text-slate-900">
            Havale bildirimlerin
          </h2>
          <DataTable label="Havale bildirimlerin, en yenisi önce" minWidth={640}>
            <thead>
              <tr>
                <th scope="col" className={th}>Tarih</th>
                <th scope="col" className={th}>Tutar</th>
                <th scope="col" className={th}>Durum</th>
                <th scope="col" className={th}>
                  <span className="sr-only">İşlem</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {transfers.items.map((t) => {
                const status = TRANSFER_STATUS[t.status];
                return (
                  <tr key={t.id}>
                    <td className={`${td} whitespace-nowrap`}>
                      {formatDate(t.transferDate)}
                      <div className="text-xs text-slate-500">{t.senderName}</div>
                    </td>
                    <td className={`${td} whitespace-nowrap tabular-nums`}>
                      {formatTryExact(t.approvedAmountTry ?? t.amountTry)}
                      {t.approvedAmountTry && t.approvedAmountTry !== t.amountTry && (
                        <div className="text-xs text-slate-500">Bildirilen: {formatTryExact(t.amountTry)}</div>
                      )}
                      {t.credits !== null && <div className="text-xs font-medium text-green-800">+{formatCredits(t.credits)}</div>}
                    </td>
                    <td className={td}>
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {t.rejectReason && <div className="mt-1 text-xs text-slate-600">Gerekçe: {t.rejectReason}</div>}
                    </td>
                    <td className={td}>
                      {t.status === "PENDING" && (
                        <ConfirmButton
                          action={cancelTransfer.bind(null, t.id)}
                          label="Geri al"
                          confirmText="Bildirim silinmez ama incelenmez. Yanlış bilgi yazdıysan geri alıp yenisini gönder."
                          confirmLabel="Evet, geri al"
                          variant="quiet"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </section>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {!summary.transfer && (
          <PanelSection id="yukleme" title="Kredi yükle">
            <p className="text-sm text-slate-700">
              Kredi kartı ve havale/EFT ile yükleme yakında bu sayfada olacak. Şimdilik kredi için{" "}
              <a href={`mailto:${COMPANY.supportEmail}`} className="font-medium text-brand-700 hover:underline">
                {COMPANY.supportEmail}
              </a>{" "}
              adresine yaz.
            </p>
          </PanelSection>
        )}
        <PanelSection id="kurallar" title="Kredi ne zaman düşer, ne zaman iade edilir?">
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Teklif gönderdiğinde düşer. Teklifi güncellemek ücretsizdir.</li>
            <li>Müşteri talebini iptal ederse kredin tamamen iade edilir.</li>
            <li>Teklifini geri çekersen ya da müşteri başka firmayı seçerse iade edilmez.</li>
          </ul>
        </PanelSection>
      </div>

      <h2 className="mb-3 text-base font-semibold text-slate-900">Hareketler</h2>
      <div className="mb-4">
        <FilterTabs
          label="Hareket türü"
          current={filter.value}
          options={CREDIT_FILTERS.map((f) => ({ value: f.value, label: f.label, href: href(f.value) }))}
        />
      </div>
      <CreditTable
        items={items}
        empty={
          filter.value === "tumu" ? (
            <>
              Henüz kredi hareketin yok.{" "}
              <Link href="/firma-paneli/talepler" className="font-medium text-brand-700 hover:underline">
                Gelen taleplere göz at
              </Link>
              .
            </>
          ) : (
            "Bu süzgece uyan hareket yok."
          )
        }
      />
      <Pager page={page} limit={LIMIT} total={total} href={(p) => href(filter.value, p)} />
    </>
  );
}
