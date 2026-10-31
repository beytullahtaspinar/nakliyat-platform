import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Arama motorları: yönetici Google/Bing/Yandex doğrulama kodunu girer, kod ana sayfada meta etiketi olarak hemen
 * yayınlanır (ikinci web sürecinde de); boş bırakılan kod kaldırılır.
 * Kodlar site genelinde tek kayıt olduğu için kaydetme yalnızca masaüstü projesinde çalışır (paralel projeler çakışmasın).
 */
const PASSWORD = "yonetici-sifre-123";
/** playwright.config.ts SECOND_WEB_PORT */
const SECOND_WEB_PORT = 3001;
const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);

async function loginAsAdmin(page: Page) {
  const phone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: phone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "Arama Editörü" },
  });
  await page.goto("/giris");
  await page.getByLabel("Cep telefonu").fill(phone);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/yonetim$/);
}

const meta = (page: Page, name: string) => page.locator(`head meta[name="${name}"]`);

test("yönetici doğrulama kodlarını girer, ana sayfada meta etiketi olur", async ({ page, browser }, testInfo) => {
  await loginAsAdmin(page);
  await page.goto("/yonetim");
  await page.getByRole("link", { name: "Arama motorları" }).first().click();
  await expect(page).toHaveURL(/\/yonetim\/arama-motorlari$/);
  await expect(page.getByRole("heading", { name: "1. Google Search Console" })).toBeVisible();
  await expect(page.getByText("https://evdenevenakliyat.app/sitemap.xml")).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`))).toEqual([]);

  test.skip(testInfo.project.name !== "masaustu", "Kodlar tek kayıt: kaydetme yalnızca masaüstünde");

  // Etiketin tamamı yapıştırılsa da kod ayıklanır
  await page.getByLabel("Google Search Console kodu").fill('<meta name="google-site-verification" content="Gsc_Test-123" />');
  await page.getByLabel("Bing Webmaster kodu (msvalidate.01)").fill("B1NGTEST");
  await page.getByRole("button", { name: "Kodları kaydet" }).click();
  await expect(page.getByRole("status")).toContainText("Kaydedildi");
  await page.reload();
  await expect(page.getByLabel("Google Search Console kodu")).toHaveValue("Gsc_Test-123");

  await page.goto("/");
  await expect(meta(page, "google-site-verification")).toHaveAttribute("content", "Gsc_Test-123");
  await expect(meta(page, "msvalidate.01")).toHaveAttribute("content", "B1NGTEST");
  await expect(meta(page, "yandex-verification")).toHaveCount(0);

  // Canlıda web birden çok süreçle çalışır: diğer süreç de yeni kodu vermeli
  const other = await browser.newContext({ baseURL: `http://127.0.0.1:${SECOND_WEB_PORT}` });
  const otherPage = await other.newPage();
  await otherPage.goto("/");
  await expect(meta(otherPage, "google-site-verification")).toHaveAttribute("content", "Gsc_Test-123");
  await other.close();

  // Boş bırakılan kod kaldırılır; geçersiz kod kaydedilmez
  await page.goto("/yonetim/arama-motorlari");
  await page.getByLabel("Google Search Console kodu").fill('"><script>');
  await page.getByRole("button", { name: "Kodları kaydet" }).click();
  await expect(page.getByText("Google doğrulama kodu yalnızca harf, rakam")).toBeVisible();
  await expect(page.getByLabel("Google Search Console kodu")).toHaveValue('"><script>');
  await page.getByLabel("Google Search Console kodu").fill("");
  await page.getByLabel("Bing Webmaster kodu (msvalidate.01)").fill("");
  await page.getByRole("button", { name: "Kodları kaydet" }).click();
  await expect(page.getByRole("status")).toContainText("Kaydedildi");
  await page.goto("/");
  await expect(meta(page, "google-site-verification")).toHaveCount(0);
  await expect(meta(page, "msvalidate.01")).toHaveCount(0);
});
