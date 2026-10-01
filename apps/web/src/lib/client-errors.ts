/**
 * Tarayıcıdaki hataları sunucuya bildirir (/api/hata-bildirimi). Sunucu bunları loglar ve
 * Sentry açıksa oraya iletir. Tarayıcıya hiçbir izleme kütüphanesi yüklenmez (PageSpeed).
 */
const ENDPOINT = "/api/hata-bildirimi";
const MAX_REPORTS_PER_PAGE = 5;
let sent = 0;

// Tarayıcı eklentileri ve bilgi taşımayan hatalar
const IGNORED = [/ResizeObserver loop/i, /^Script error\.?$/i, /extension:\/\//i];

export type ClientErrorSource = "window" | "promise" | "boundary";

export function reportClientError(error: unknown, source: ClientErrorSource, digest?: string) {
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
