/**
 * Kredi kuralları: ayarların şekli, sınırları ve teklif başına kredi.
 * Kredi tam sayıdır. Teklif verilirken düşer; geri çekmede iade yok, talep iptalinde tam iade,
 * seçim yapılmadan süresi dolan talepte ayardaki oran kadar iade.
 */

export interface CreditSettings {
  /** Kapalıyken teklif ücretsizdir, kredi düşmez */
  enabled: boolean;
  /** 1 kredinin TL karşılığı (KDV dahil); yükleme ekranlarında ve raporlarda kullanılır */
  creditValueTry: number;
  /** Aynı il içindeki talebe teklif */
  quoteCostLocal: number;
  /** İller arası talebe teklif */
  quoteCostIntercity: number;
  /** Yönetim onaylayınca firmaya bir kez verilen kredi */
  welcomeCredits: number;
  /** Hiçbir teklif seçilmeden süresi dolan talepte iade yüzdesi */
  expiredRefundPercent: number;
  /** Bakiye bunun altına inince firma panelinde uyarı görünür */
  lowBalanceThreshold: number;
  /** Havale bildiriminde en az tutar (TL) */
  minTopupTry: number;
  /** Havale/EFT yapılacak hesaplar; boşsa firma havale bildiremez */
  bankAccounts: BankAccount[];
  /** Kartla ödeme (iyzico anahtarları sunucuda tanımlıysa) */
  cardEnabled: boolean;
  /** Açıkken her teklif güncellemesi, teklifin ilk kredisi kadar düşer. Kapalıyken güncelleme ücretsizdir. */
  chargeQuoteUpdates: boolean;
}

export type BankAccount = {
  bank: string;
  holder: string;
  /** Boşluksuz, büyük harf: TR + 24 rakam */
  iban: string;
};

export type CreditSettingKey = keyof Omit<CreditSettings, 'enabled' | 'bankAccounts' | 'cardEnabled' | 'chargeQuoteUpdates'>;

export const CREDIT_SETTING_LIMITS: Record<CreditSettingKey, { min: number; max: number; integer: boolean }> = {
  creditValueTry: { min: 0.01, max: 10_000, integer: false },
  quoteCostLocal: { min: 0, max: 100_000, integer: true },
  quoteCostIntercity: { min: 0, max: 100_000, integer: true },
  welcomeCredits: { min: 0, max: 100_000, integer: true },
  expiredRefundPercent: { min: 0, max: 100, integer: true },
  lowBalanceThreshold: { min: 0, max: 1_000_000, integer: true },
  minTopupTry: { min: 1, max: 1_000_000, integer: true },
};

export const MAX_BANK_ACCOUNTS = 3;

/** Değerler örnektir; yönetim değiştirir. Sistem kapalı başlar. */
export const DEFAULT_CREDIT_SETTINGS: CreditSettings = {
  enabled: false,
  creditValueTry: 1,
  quoteCostLocal: 50,
  quoteCostIntercity: 100,
  welcomeCredits: 0,
  expiredRefundPercent: 0,
  lowBalanceThreshold: 100,
  minTopupTry: 100,
  bankAccounts: [],
  cardEnabled: false,
  chargeQuoteUpdates: false,
};

/** Kartla tek seferde en fazla yükleme (TL) */
export const CARD_MAX_TRY = 50_000;

/** Kayıttaki ayar eksik ya da bozuksa o alan için varsayılan kullanılır */
export function normalizeCreditSettings(raw: unknown): CreditSettings {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: CreditSettings = { ...DEFAULT_CREDIT_SETTINGS };
  if (typeof src.enabled === 'boolean') out.enabled = src.enabled;
  if (typeof src.cardEnabled === 'boolean') out.cardEnabled = src.cardEnabled;
  if (typeof src.chargeQuoteUpdates === 'boolean') out.chargeQuoteUpdates = src.chargeQuoteUpdates;
  for (const [key, { min, max, integer }] of Object.entries(CREDIT_SETTING_LIMITS) as [CreditSettingKey, (typeof CREDIT_SETTING_LIMITS)[CreditSettingKey]][]) {
    const v = src[key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max && (!integer || Number.isInteger(v))) out[key] = v;
  }
  if (Array.isArray(src.bankAccounts)) out.bankAccounts = src.bankAccounts.flatMap((a) => normalizeBankAccount(a) ?? []).slice(0, MAX_BANK_ACCOUNTS);
  return out;
}

function normalizeBankAccount(raw: unknown): BankAccount | null {
  if (!raw || typeof raw !== 'object') return null;
  const { bank, holder, iban } = raw as Record<string, unknown>;
  if (typeof bank !== 'string' || typeof holder !== 'string' || typeof iban !== 'string') return null;
  const clean = normalizeIban(iban);
  if (!bank.trim() || !holder.trim() || !isValidTrIban(clean)) return null;
  return { bank: bank.trim(), holder: holder.trim(), iban: clean };
}

/** Boşlukları atar, büyük harfe çevirir */
export const normalizeIban = (iban: string) => iban.replace(/\s+/g, '').toUpperCase();

/** Türkiye IBAN'ı: TR + 24 rakam ve ISO 13616 mod 97 denetimi */
export function isValidTrIban(iban: string) {
  if (!/^TR\d{24}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  return rest === 1;
}

/** Ekranda dörtlü gruplar: TR12 3456 ... */
export const formatIban = (iban: string) => iban.replace(/(.{4})/g, '$1 ').trim();

/** Yatırılan tutarın kredi karşılığı (aşağı yuvarlanır); kuruş hesabıyla, kayan nokta hatası olmadan */
export const creditsForAmount = (amountTry: number, creditValueTry: number) =>
  Math.floor(Math.round(amountTry * 100) / Math.round(creditValueTry * 100));

/** Havale açıklama kodu: karışan harfler (0/O, 1/I/L) yok */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function makeTransferCode(random: (n: number) => number) {
  let code = 'EN-';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  return code;
}

/** Teklif başına kredi: aynı il içi ya da iller arası. Sistem kapalıysa 0. */
export function quoteCost(request: { fromCityCode: string; toCityCode: string }, settings: CreditSettings): number {
  if (!settings.enabled) return 0;
  return request.fromCityCode === request.toCityCode ? settings.quoteCostLocal : settings.quoteCostIntercity;
}

/** Seçimsiz süresi dolan talepte iade edilecek kredi (aşağı yuvarlanır) */
export const expiredRefund = (charged: number, percent: number) => Math.floor((charged * percent) / 100);

/** Süre dolumu iadesi geriye dönük taranmaz: yalnızca son bu kadar günde süresi dolan talepler */
export const EXPIRED_REFUND_WINDOW_DAYS = 3;
