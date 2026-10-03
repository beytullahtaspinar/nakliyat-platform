import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Blog: içerik sahte WordPress'ten gelir (e2e/wordpress-mock.mjs, playwright.config.ts).
 * Derlemede WordPress çalışmadığı için /blog boş üretilir; ilk adım yenileme adresini çağırır
 * (WordPress'in yazı yayınlayınca yaptığı gibi) ve sayfa yazılarla yeniden üretilir.
 */
const SECRET = "e2e-blog-yenileme-anahtari";

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const summary = results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`));
  expect(summary, "Erişilebilirlik ihlalleri").toEqual([]);
}

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function jsonLdTypes(page: Page) {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.flatMap((text) => [JSON.parse(text)].flat().map((item: { "@type": string }) => item["@type"]));
}

test.describe.configure({ mode: "serial" });

test("yenileme adresi anahtarsız isteği reddeder, doğru anahtarla önbelleği yeniler", async ({ request }) => {
  const wrong = await request.post("/api/blog/yenile", { headers: { Authorization: "Bearer yanlis-anahtar" } });
  expect(wrong.status()).toBe(401);
  const ok = await request.post("/api/blog/yenile", { headers: { Authorization: `Bearer ${SECRET}` } });
  expect(ok.ok()).toBe(true);
});

test("blog listesi yazıları, kategorileri gösterir ve erişilebilir", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/blog");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Taşınma rehberi");
  await expect(page.getByRole("link", { name: "Taşınma kontrol listesi: 4 haftalık plan" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Blog kategorileri" }).getByRole("link", { name: "Taşınma Rehberi" })).toBeVisible();
  expect(await jsonLdTypes(page)).toEqual(expect.arrayContaining(["Blog", "BreadcrumbList"]));
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /^index/);
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test("yazı sayfası temiz içerik, içindekiler ve yapısal veri içerir", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/blog");
  await page.getByRole("link", { name: "Taşınma kontrol listesi: 4 haftalık plan" }).click();
  await expect(page).toHaveURL(/\/blog\/tasinma-kontrol-listesi$/);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Taşınma kontrol listesi: 4 haftalık plan");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByText("Elif Yılmaz").first()).toBeVisible();
  await expect(page).toHaveTitle(/^Taşınma kontrol listesi: 4 haftalık plan \|/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /dört hafta boyunca/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/blog\/tasinma-kontrol-listesi$/);

  // WordPress içeriğindeki betik, iframe ve olay nitelikleri atılır
  const article = page.locator("article");
  await expect(article.locator("script, iframe, [onclick], [style]")).toHaveCount(0);
  // WordPress adresine verilen bağlantı sitenin blog adresine çevrilir
  await expect(article.getByRole("link", { name: "teklif al" })).toHaveAttribute("href", "/blog/nakliyat-fiyatlari-2026");

  const toc = page.getByRole("navigation", { name: "İçindekiler" });
  await toc.getByRole("link", { name: "İki hafta önce" }).click();
  await expect(page).toHaveURL(/#iki-hafta-once$/);

  expect(await jsonLdTypes(page)).toEqual(expect.arrayContaining(["BlogPosting", "BreadcrumbList"]));
  await expect(page.getByRole("heading", { name: "İlgili yazılar" })).toBeVisible();
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test("kategori sayfası yalnızca o kategorinin yazılarını gösterir; olmayan yazı ve kategori 404", async ({ page }) => {
  await page.goto("/blog/kategori/nakliyat-fiyatlari");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nakliyat Fiyatları");
  await expect(page.getByRole("link", { name: "Evden eve nakliyat fiyatları 2026" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Koli nasıl hazırlanır?" })).toHaveCount(0);
  await expectAccessible(page);

  expect((await page.goto("/blog/boyle-bir-yazi-yok"))?.status()).toBe(404);
  expect((await page.goto("/blog/kategori/boyle-bir-kategori-yok"))?.status()).toBe(404);
  expect((await page.goto("/blog/sayfa/9"))?.status()).toBe(404);
});

test("RSS, site haritası ve llms.txt blogu listeler", async ({ request }) => {
  const rss = await (await request.get("/blog/rss.xml")).text();
  expect(rss).toContain("<title>Taşınma kontrol listesi: 4 haftalık plan</title>");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/blog/tasinma-kontrol-listesi</loc>");
  expect(sitemap).toContain("/blog/kategori/tasinma-rehberi</loc>");
  expect(await (await request.get("/llms.txt")).text()).toContain("/blog");
});
