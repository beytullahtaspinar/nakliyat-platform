/**
 * Sunucu tarafı hata raporlayıcı (yalnızca Node.js çalışma ortamında içe aktarılır).
 * Hatalar JSON log olarak yazılır; SENTRY_DSN tanımlıysa Sentry'ye de gider.
 */
import path from "node:path";
import { createErrorReporter, readRelease } from "@nakliyat/monitoring";

// Sunucuda RELEASE dosyası uygulama klasöründe (server.js'in yanında) durur
export const APP_RELEASE = readRelease(path.join(process.cwd(), "RELEASE"));

export const errorReporter = createErrorReporter({
  service: "web",
  dsn: process.env.SENTRY_DSN,
  release: APP_RELEASE,
  environment: process.env.NODE_ENV,
});
