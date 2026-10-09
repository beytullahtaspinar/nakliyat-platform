/** Kredi defteri: türler, etiketler ve biçimler (API: /company/credits, /admin/credits) */

export type CreditTransactionType = "QUOTE" | "QUOTE_REFUND" | "ADMIN_CREDIT" | "ADMIN_DEBIT" | "WELCOME" | "TRANSFER_TOPUP" | "CARD_TOPUP";

export const CREDIT_TYPE_LABELS: Record<CreditTransactionType, string> = {
  QUOTE: "Teklif",
  QUOTE_REFUND: "Teklif iadesi",
  ADMIN_CREDIT: "Yönetim ekledi",
  ADMIN_DEBIT: "Yönetim düştü",
  WELCOME: "Hoş geldin kredisi",
  TRANSFER_TOPUP: "Havale/EFT",
  CARD_TOPUP: "Kartla ödeme",
};

/** Liste süzgeçleri: adres çubuğundaki değer → API türü */
export const CREDIT_FILTERS: { value: string; label: string; type?: CreditTransactionType }[] = [
  { value: "tumu", label: "Tümü" },
  { value: "teklif", label: "Teklif", type: "QUOTE" },
  { value: "kart", label: "Kart", type: "CARD_TOPUP" },
  { value: "havale", label: "Havale/EFT", type: "TRANSFER_TOPUP" },
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

export type BankAccount = { bank: string; holder: string; iban: string };

export type CompanyCreditSummary = {
  enabled: boolean;
  balance: number;
  creditValueTry: number;
  quoteCostLocal: number;
  quoteCostIntercity: number;
  lowBalanceThreshold: number;
  /** Banka hesabı tanımlı değilse null: havale bildirimi kapalı */
  transfer: { code: string; minTopupTry: number; bankAccounts: BankAccount[] } | null;
  /** Kartla ödeme kapalıysa ya da iyzico anahtarları yoksa null */
  card: { minTry: number; maxTry: number; sandbox: boolean } | null;
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
  minTopupTry: number;
  bankAccounts: BankAccount[];
  cardEnabled: boolean;
  chargeQuoteUpdates: boolean;
};

export type AdminCreditSettings = {
  settings: CreditSettings;
  defaults: CreditSettings;
  updatedAt: string | null;
  /** iyzico anahtarları sunucuda tanımlı mı, deneme ortamı mı */
  card: { configured: boolean; sandbox: boolean };
};

type TypeTotals = Record<CreditTransactionType, { amount: number; count: number }>;

export type CreditOverview = {
  enabled: boolean;
  creditValueTry: number;
  totalBalance: number;
  companiesWithBalance: number;
  monthStart: string;
  month: TypeTotals;
  allTime: TypeTotals;
  transfersPending: number;
};

export type AdminCompanyCredits = {
  balance: number;
  recent: { items: CreditTransaction[]; total: number };
};

type NumberKey = Exclude<keyof CreditSettings, "enabled" | "bankAccounts" | "cardEnabled" | "chargeQuoteUpdates">;

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
  { key: "minTopupTry", label: "En az yükleme", unit: "TL", hint: "Havale bildiriminde en az tutar", min: 1, max: 1_000_000 },
];

export const MAX_BANK_ACCOUNTS = 3;

export const formatCredits = (n: number) => `${n.toLocaleString("tr-TR")} kredi`;

/** Hareket miktarı: artı işaretli */
export const signedCredits = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("tr-TR")}`;

export const creditRoute = (r: NonNullable<CreditTransaction["request"]>) => `${r.fromCityName ?? "?"} → ${r.toCityName ?? "?"}`;

/** Ekranda dörtlü gruplar: TR12 3456 ... */
export const formatIban = (iban: string) => iban.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();

/** Kuruşlu TL: 1.450,00 TL */
const tryFormat = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatTryExact = (value: string | number) => tryFormat.format(Number(value));

/** Yatırılan tutarın kredi karşılığı (API ile aynı: kuruş hesabı, aşağı yuvarlanır) */
export const creditsForAmount = (amountTry: number, creditValueTry: number) =>
  Math.floor(Math.round(amountTry * 100) / Math.round(creditValueTry * 100));

// ─── Havale/EFT bildirimleri ─────────────────────────────────

export type BankTransferStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export const TRANSFER_STATUS: Record<BankTransferStatus, { label: string; tone: "warning" | "success" | "danger" | "neutral" }> = {
  PENDING: { label: "Onay bekliyor", tone: "warning" },
  APPROVED: { label: "Onaylandı", tone: "success" },
  REJECTED: { label: "Reddedildi", tone: "danger" },
  CANCELLED: { label: "Geri alındı", tone: "neutral" },
};

/** Yönetim süzgeçleri: adres çubuğundaki değer → API durumu */
export const TRANSFER_FILTERS: { value: string; label: string; status?: BankTransferStatus }[] = [
  { value: "bekleyen", label: "Onay bekleyen", status: "PENDING" },
  { value: "onaylanan", label: "Onaylanan", status: "APPROVED" },
  { value: "reddedilen", label: "Reddedilen", status: "REJECTED" },
  { value: "geri-alinan", label: "Geri alınan", status: "CANCELLED" },
  { value: "tumu", label: "Tümü" },
];

export type BankTransfer = {
  id: string;
  status: BankTransferStatus;
  amountTry: string;
  approvedAmountTry: string | null;
  credits: number | null;
  senderName: string;
  transferDate: string;
  /** Dörtlü gruplanmış */
  iban: string;
  note: string | null;
  rejectReason: string | null;
  receipt: { fileName: string; mimeType: string | null; sizeBytes: number | null; url: string } | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type AdminBankTransfer = BankTransfer & {
  company: { id: string; displayName: string; legalName: string; balance: number };
  transferCode: string | null;
  reviewedBy: { id: string; fullName: string } | null;
  expectedCredits: number | null;
};

export type AdminBankTransferList = {
  items: AdminBankTransfer[];
  total: number;
  page: number;
  limit: number;
  pending: number;
  creditValueTry: number;
};

/**
 * Elle yazılan TL tutarı: "1500", "1500.5", "1.500", "1.500,50" → sayı; geçersizse NaN.
 * Virgül varsa ondalık ayırıcıdır; virgülsüz "1.500" binlik ayırıcı sayılır.
 */
export function parseTryAmount(raw: string) {
  const s = raw.trim().replace(/\s|TL|₺/gi, "");
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s;
  return /^\d+(\.\d{1,2})?$/.test(normalized) ? Number(normalized) : NaN;
}

// ─── Kartla ödeme (iyzico) ───────────────────────────────────

export type CardPaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "EXPIRED";

export const CARD_STATUS: Record<CardPaymentStatus, { label: string; tone: "warning" | "success" | "danger" | "neutral" }> = {
  PENDING: { label: "Bekliyor", tone: "warning" },
  SUCCESS: { label: "Başarılı", tone: "success" },
  FAILED: { label: "Başarısız", tone: "danger" },
  EXPIRED: { label: "Tamamlanmadı", tone: "neutral" },
};

export const CARD_FILTERS: { value: string; label: string; status?: CardPaymentStatus }[] = [
  { value: "tumu", label: "Tümü" },
  { value: "basarili", label: "Başarılı", status: "SUCCESS" },
  { value: "basarisiz", label: "Başarısız", status: "FAILED" },
  { value: "bekleyen", label: "Bekleyen", status: "PENDING" },
  { value: "tamamlanmayan", label: "Tamamlanmadı", status: "EXPIRED" },
];

/** Kart formunda hızlı seçim tutarları (TL) */
export const CARD_PRESETS = [500, 1000, 2500, 5000];

export type CardPayment = {
  id: string;
  status: CardPaymentStatus;
  amountTry: string;
  credits: number;
  sandbox: boolean;
  providerPaymentId: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type AdminCardPaymentList = {
  items: (CardPayment & { company: { id: string; displayName: string }; user: { id: string; fullName: string } | null })[];
  total: number;
  page: number;
  limit: number;
  last30Days: { count: number; amountTry: string; credits: number };
  configured: boolean;
  sandbox: boolean;
};
