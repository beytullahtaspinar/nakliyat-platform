/**
 * Görünen ad kuralları. Onaylı firma adını değiştirince yeni ad yönetim onayına düşer; onaylanana kadar
 * eski ad yayında kalır. Kötüye kullanımı (kötü yorumdan kaçmak için sürekli ad değiştirmek) sınırlamak
 * için son 365 günde en fazla NAME_CHANGE_LIMIT değişiklik onaylanır. Yönetimin doğrudan yaptığı
 * düzeltmeler ve reddedilen talepler sayılmaz.
 */
export const NAME_CHANGE_LIMIT = 2;
export const NAME_CHANGE_WINDOW_DAYS = 365;
const WINDOW_MS = NAME_CHANGE_WINDOW_DAYS * 86_400_000;

/** Sınır penceresinin başlangıcı: bu tarihten sonra onaylananlar sayılır */
export const nameChangeWindowStart = (now = new Date()) => new Date(now.getTime() - WINDOW_MS);

/**
 * Kalan hak ve hak bittiyse bir sonraki değişikliğin yapılabileceği gün.
 * approvedAt: son 365 günde onaylanan değişikliklerin onay tarihleri.
 */
export function nameChangeQuota(approvedAt: Date[], now = new Date()) {
  const start = nameChangeWindowStart(now).getTime();
  const recent = approvedAt.filter((d) => d.getTime() > start).sort((a, b) => a.getTime() - b.getTime());
  const remaining = Math.max(0, NAME_CHANGE_LIMIT - recent.length);
  // En eski onay pencereden çıkınca bir hak açılır
  const nextAvailableAt = remaining === 0 ? new Date(recent[recent.length - NAME_CHANGE_LIMIT].getTime() + WINDOW_MS) : null;
  return { limit: NAME_CHANGE_LIMIT, used: recent.length, remaining, nextAvailableAt };
}

/** Ad karşılaştırması: baştaki/sondaki ve art arda boşluklar fark sayılmaz */
export const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ');
