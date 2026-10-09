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
}

export type CreditSettingKey = keyof Omit<CreditSettings, 'enabled'>;

export const CREDIT_SETTING_LIMITS: Record<CreditSettingKey, { min: number; max: number; integer: boolean }> = {
  creditValueTry: { min: 0.01, max: 10_000, integer: false },
  quoteCostLocal: { min: 0, max: 100_000, integer: true },
  quoteCostIntercity: { min: 0, max: 100_000, integer: true },
  welcomeCredits: { min: 0, max: 100_000, integer: true },
  expiredRefundPercent: { min: 0, max: 100, integer: true },
  lowBalanceThreshold: { min: 0, max: 1_000_000, integer: true },
};

/** Değerler örnektir; yönetim değiştirir. Sistem kapalı başlar. */
export const DEFAULT_CREDIT_SETTINGS: CreditSettings = {
  enabled: false,
  creditValueTry: 1,
  quoteCostLocal: 50,
  quoteCostIntercity: 100,
  welcomeCredits: 0,
  expiredRefundPercent: 0,
  lowBalanceThreshold: 100,
};

/** Kayıttaki ayar eksik ya da bozuksa o alan için varsayılan kullanılır */
export function normalizeCreditSettings(raw: unknown): CreditSettings {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: CreditSettings = { ...DEFAULT_CREDIT_SETTINGS };
  if (typeof src.enabled === 'boolean') out.enabled = src.enabled;
  for (const [key, { min, max, integer }] of Object.entries(CREDIT_SETTING_LIMITS) as [CreditSettingKey, (typeof CREDIT_SETTING_LIMITS)[CreditSettingKey]][]) {
    const v = src[key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max && (!integer || Number.isInteger(v))) out[key] = v;
  }
  return out;
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
