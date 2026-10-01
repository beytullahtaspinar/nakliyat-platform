/**
 * Lighthouse CI: Google PageSpeed'in kullandığı ölçümün aynısı, her PR'da.
 * Mobil ölçüm (yavaş 4G + orta seviye telefon), her sayfa 3 kez ölçülür ve ortanca alınır.
 *
 * Kural: Erişilebilirlik, En İyi Uygulamalar ve SEO tam puan (100); performans en az 95.
 * Giriş/kayıt/talep formu arama motorlarına bilerek kapalı (noindex), bu yüzden onlarda SEO ölçülmez.
 *
 * Yerelde: pnpm build && pnpm --filter @nakliyat/web lighthouse
 */
const PUBLIC_PAGES = ["/", "/evden-eve-nakliyat", "/istanbul-evden-eve-nakliyat", "/istanbul-kadikoy-evden-eve-nakliyat"];
const NOINDEX_PAGES = ["/talep-olustur", "/giris"];
const BASE = "http://127.0.0.1:3000";

module.exports = {
  ci: {
    collect: {
      url: [...PUBLIC_PAGES, ...NOINDEX_PAGES].map((p) => BASE + p),
      numberOfRuns: 3,
      startServerCommand:
        "cp -r .next/static .next/standalone/apps/web/.next/ && cp -r public .next/standalone/apps/web/ && " +
        "PORT=3000 HOSTNAME=127.0.0.1 node .next/standalone/apps/web/server.js",
      startServerReadyPattern: "Ready",
      settings: { chromeFlags: "--no-sandbox --headless=new" },
    },
    assert: {
      assertMatrix: [
        {
          matchingUrlPattern: "^(?!.*(talep-olustur|giris)).*$",
          assertions: {
            "categories:performance": ["error", { minScore: 0.95, aggregationMethod: "median-run" }],
            "categories:accessibility": ["error", { minScore: 1 }],
            "categories:best-practices": ["error", { minScore: 1 }],
            "categories:seo": ["error", { minScore: 1 }],
          },
        },
        {
          matchingUrlPattern: "(talep-olustur|giris)",
          assertions: {
            "categories:performance": ["error", { minScore: 0.95, aggregationMethod: "median-run" }],
            "categories:accessibility": ["error", { minScore: 1 }],
            "categories:best-practices": ["error", { minScore: 1 }],
          },
        },
      ],
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci/rapor" },
  },
};
