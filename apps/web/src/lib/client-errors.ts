/**
 * Tarayıcıdaki hataları sunucuya bildirir (/api/hata-bildirimi). Sunucu bunları loglar ve
 * Sentry açıksa oraya iletir. Tarayıcıya hiçbir izleme kütüphanesi yüklenmez (PageSpeed).
 */
import { unstable_isUnrecognizedActionError } from "next/navigation";

const ENDPOINT = "/api/hata-bildirimi";
const RELOAD_KEY = "nk_surum_yenileme";
const MAX_REPORTS_PER_PAGE = 5;
let sent = 0;

// Tarayıcı eklentileri ve bilgi taşımayan hatalar.
// "Connection closed.": sayfa geçişindeki sunucu yanıtı (RSC akışı) yarıda kesildi. Yeni sürüm
// kurulurken uygulama yeniden başladığında, bağlantı koptuğunda ya da sekme kapanırken olur;
// sunucu tarafında gerçek bir hata varsa o zaten sunucu loglarından ayrıca bildirilir.
const IGNORED = [/ResizeObserver loop/i, /^Script error\.?$/i, /extension:\/\//i, /^Connection closed\.?$/m];

export type ClientErrorSource = "window" | "promise" | "boundary";

/**
 * Sekme açıkken yeni sürüm yayınlandıysa eski sayfanın form eylemleri sunucuda bulunamaz
 * (UnrecognizedActionError). Bu bir hata değil: sayfa bir kez yenilenip yeni sürüm yüklenir.
 * Döngüye girmemek için aynı sekmede 30 saniye içinde ikinci kez yenilenmez.
 */
function reloadIfStaleBuild(error: unknown): boolean {
  const stale =
    unstable_isUnrecognizedActionError(error) || (error instanceof Error && error.name === "UnrecognizedActionError");
  if (!stale) return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage kapalıysa yine de bir kez yenile
  }
  window.location.reload();
  return true;
}

export function reportClientError(error: unknown, source: ClientErrorSource, digest?: string) {
  if (reloadIfStaleBuild(error)) return;
  try {
    if (sent >= MAX_REPORTS_PER_PAGE) return;
    const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Bilinmeyen hata");
    const text = `${err.message}\n${err.stack ?? ""}`;
    if (IGNORED.some((re) => re.test(text))) return;
    sent++;
    const body = JSON.stringify({
      type: err.name,
      message: err.message.slice(0, 1000),
      stack: err.stack?.slice(0, 6000),
      path: window.location.pathname,
      source,
      digest,
    });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.(ENDPOINT, blob)) {
      void fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
    }
  } catch {
    // Hata bildirimi asla yeni hata üretmemeli
  }
}
