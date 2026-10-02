import { defineConfig, devices } from "@playwright/test";

/**
 * Uçtan uca (tarayıcı) testleri. Gerçek API ve veritabanıyla çalışır.
 *
 * Yerelde: MariaDB açık, `pnpm build` yapılmış olmalı; sonra `pnpm --filter @nakliyat/web test:e2e`.
 * Sunucular zaten açıksa yeniden başlatılmaz.
 */
const WEB_PORT = 3000;
const API_PORT = 4000;
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: "mobil", use: { ...devices["Pixel 7"] } },
    { name: "masaustu", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: "node dist/main.js",
      cwd: "../api",
      url: `http://localhost:${API_PORT}/v1/health`,
      reuseExistingServer: !CI,
      env: {
        PORT: String(API_PORT),
        // Sayfalar 127.0.0.1'de açılır; Google/Apple dönüş adresi de aynı adreste olmalı (çerezler)
        WEB_URL: `http://127.0.0.1:${WEB_PORT}`,
        // Sahte "test" girişi (Google yerine); canlıda yok sayılır
        OAUTH_TEST_PROVIDER: "1",
        AUTH_RATE_LIMIT: "1000",
        // Doğrulama kodları sabit (e2e/dogrulama.ts); NODE_ENV=production'da yok sayılır
        VERIFICATION_TEST_CODE: "424242",
        // Tarayıcı dosyayı doğrudan API'ye yükler (yerel disk sürücüsü); sayfa 127.0.0.1'de açıldığı için
        CORS_EXTRA_ORIGINS: `http://127.0.0.1:${WEB_PORT}`,
        API_PUBLIC_URL: `http://127.0.0.1:${API_PORT}`,
      },
      timeout: 60_000,
    },
    {
      // Canlıdaki gibi: Next.js standalone çıktısı (statik dosyalar yanına kopyalanır)
      command:
        "cp -r .next/static .next/standalone/apps/web/.next/ && cp -r public .next/standalone/apps/web/ && " +
        "node .next/standalone/apps/web/server.js",
      url: `http://127.0.0.1:${WEB_PORT}/api/saglik`,
      reuseExistingServer: !CI,
      // GitHub Actions HOSTNAME değişkenini makine adına ayarlar; sunucu yerel adreste dinlesin
      env: { PORT: String(WEB_PORT), HOSTNAME: "127.0.0.1", API_URL: `http://localhost:${API_PORT}` },
      timeout: 60_000,
    },
  ],
});
