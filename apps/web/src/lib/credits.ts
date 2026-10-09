/** Kredi defteri: türler, etiketler ve biçimler (API: /company/credits, /admin/credits) */

export type CreditTransactionType = "QUOTE" | "QUOTE_REFUND" | "ADMIN_CREDIT" | "ADMIN_DEBIT" | "WELCOME";

export const CREDIT_TYPE_LABELS: Record<CreditTransactionType, string> = {
  QUOTE: "Teklif",
  QUOTE_REFUND: "Teklif iadesi",
  ADMIN_CREDIT: "Yönetim ekledi",
  ADMIN_DEBIT: "Yönetim düştü",
  WELCOME: "Hoş geldin kredisi",
};

/** Liste süzgeçleri: adres çubuğundaki değer → API türü */
export const CREDIT_FILTERS: { value: string; label: string; type?: CreditTransactionType }[] = [
  { value: "tumu", label: "Tümü" },
  { value: "teklif", label: "Teklif", type: "QUOTE" },
  { value: "iade", label: "İade", type: "QUOTE_REFUND" },
  { value: "eklenen", label: "Yönetim ekledi", type: "ADMIN_CREDIT" },
  { value: "dusulen", label: "Yönetim düştü", type: "ADMIN_DEBIT" },
  { value: "hos-geldin", label: "Hoş geldin", type: "WELCOME" },
];

export type CreditTransaction = {
  id: string;
  type: CreditTransactionType;
  amount: number;
  balanceAfter: number;
  note: string | null;
  quoteId: string | null;
  createdAt: string;
  company: { id: string; displayName: string };
  actor: { id: string; fullName: string } | null;
  request: { id: string; fromCityName: string | null; toCityName: string | null } | null;
};

export type CompanyCreditSummary = {
  enabled: boolean;
  balance: number;
  creditValueTry: number;
  quoteCostLocal: number;
  quoteCostIntercity: number;
  lowBalanceThreshold: number;
};

/** Talep ayrıntısında: bu talebe teklif kaç kredi */
export type RequestCredit = { enabled: boolean; cost: number; balance: number };

export type CreditSettings = {
  enabled: boolean;
  creditValueTry: number;
  quoteCostLocal: number;
  quoteCostIntercity: number;
  welcomeCredits: number;
  expiredRefundPercent: number;
  lowBalanceThreshold: number;
};

export type AdminCreditSettings = { settings: CreditSettings; defaults: CreditSettings; updatedAt: string | null };

type TypeTotals = Record<CreditTransactionType, { amount: number; count: number }>;

export type CreditOverview = {
  enabled: boolean;
  creditValueTry: number;
  totalBalance: number;
  companiesWithBalance: number;
  monthStart: string;
  month: TypeTotals;
  allTime: TypeTotals;
};

export type AdminCompanyCredits = {
  balance: number;
  recent: { items: CreditTransaction[]; total: number };
};

type NumberKey = Exclude<keyof CreditSettings, "enabled">;

/** Yönetim ayar formu: alanlar, birimleri ve sınırları (API ile aynı) */
export const CREDIT_SETTING_FIELDS: { key: NumberKey; label: string; unit: string; hint: string; min: number; max: number; decimal?: boolean }[] = [
  { key: "quoteCostLocal", label: "Şehir içi teklif", unit: "kredi", hint: "Aynı il içindeki talebe teklif", min: 0, max: 100_000 },
  { key: "quoteCostIntercity", label: "Şehirler arası teklif", unit: "kredi", hint: "İller arası talebe teklif", min: 0, max: 100_000 },
  { key: "creditValueTry", label: "1 kredinin değeri", unit: "TL, KDV dahil", hint: "Yükleme ve raporlarda kullanılır", min: 0.01, max: 10_000, decimal: true },
  { key: "welcomeCredits", label: "Hoş geldin kredisi", unit: "kredi", hint: "Onaylanan firmaya bir kez verilir; 0 kapalı", min: 0, max: 100_000 },
  {
    key: "expiredRefundPercent",
    label: "Seçimsiz kapanan talepte iade",
    unit: "%",
    hint: "Hiçbir teklif seçilmeden süresi dolan talepte",
    min: 0,
    max: 100,
  },
  { key: "lowBalanceThreshold", label: "Düşük bakiye uyarısı", unit: "kredi", hint: "Altına inince firma panelinde uyarı", min: 0, max: 1_000_000 },
];

export const formatCredits = (n: number) => `${n.toLocaleString("tr-TR")} kredi`;

/** Hareket miktarı: artı işaretli */
export const signedCredits = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("tr-TR")}`;

export const creditRoute = (r: NonNullable<CreditTransaction["request"]>) => `${r.fromCityName ?? "?"} → ${r.toCityName ?? "?"}`;
