import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "yonetici-sifre-123";
const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

const range = (page: Page) => page.getByRole("region", { name: "Tahmini fiyat aralığı" }).locator("[aria-live]");

test("fiyat hesaplayıcı seçimlere göre tahmini aralık verir ve talep formunu doldurur", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/nakliyat-fiyat-hesaplama");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Evden eve nakliyat fiyat hesaplama");
  await expect(range(page)).toContainText("İstanbul şehir içi");
  const local = await range(page).textContent();
  expect(local).toMatch(/\d{1,3}(\.\d{3})* TL – \d{1,3}(\.\d{3})* TL/);
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);

  await page.getByLabel("Nereye").selectOption({ label: "Ankara" });
  await page.getByRole("radio", { name: "3+1", exact: true }).check({ force: true });
  await expect(range(page)).toContainText("İstanbul → Ankara");
  expect(await range(page).textContent()).not.toEqual(local);

  await page.getByRole("checkbox", { name: "Eşyaları firma paketlesin" }).check();
  await page.getByRole("link", { name: "Bu bilgilerle ücretsiz teklif al" }).click();
  await expect(page).toHaveURL(/\/talep-olustur\?nereden=34&nereye=06&ev=THREE_PLUS_ONE/);
  await expect(page.locator('select[name="homeType"]')).toHaveValue("THREE_PLUS_ONE");
  await expect(page.locator('select[name="toCityCode"]')).toHaveValue("06");
  await expect(page.getByRole("checkbox", { name: "Eşyalarımı firma paketlesin" })).toBeChecked();
  expect(errors).toEqual([]);
});

test("il sayfasından gelen güzergâh hesaplayıcıda seçili gelir", async ({ page }) => {
  await page.goto("/istanbul-ankara-sehirler-arasi-nakliyat");
  await page.getByRole("link", { name: "Tahmini fiyatı hesapla" }).click();
  await expect(page).toHaveURL(/nereden=34&nereye=06/);
  await expect(page.getByLabel("Nereden")).toHaveValue("34");
  await expect(page.getByLabel("Nereye")).toHaveValue("06");
  await expect(range(page)).toContainText("İstanbul → Ankara");
});

test("yönetici katsayıları değiştirir, hesaplama sayfası hemen güncellenir", async ({ page }, testInfo) => {
  // Katsayılar tüm siteyle ortak: iki proje aynı anda değiştirirse birbirinin beklediği değeri bozar
  test.skip(testInfo.project.name !== "masaustu", "Ortak katsayıları yalnızca masaüstü projesi değiştirir");
  const adminPhone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: adminPhone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "Fiyat Yönetici" },
  });
  await page.goto("/giris");
  await page.getByLabel("Cep telefonu").fill(adminPhone);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/yonetim$/);

  await page.getByRole("navigation", { name: "Yönetim" }).getByRole("link", { name: "Fiyat hesaplayıcı" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Fiyat hesaplayıcı" })).toBeVisible();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);

  const field = page.getByLabel("Sabit masraf");
  await field.fill("-5");
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Sabit masraf 0 ile 100.000 arasında olmalı" })).toBeVisible();

  await field.fill("53000");
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Katsayılar kaydedildi" })).toBeVisible();
  await page.goto("/nakliyat-fiyat-hesaplama");
  await expect(page.getByText("53.000 TL", { exact: true })).toBeVisible();

  // Varsayılanlara geri dön (diğer testler varsayılan katsayıları bekleyebilir)
  await page.goto("/yonetim/fiyat-hesaplama");
  await page.getByRole("button", { name: "Varsayılanları doldur" }).click();
  await expect(field).toHaveValue("3000");
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Katsayılar kaydedildi" })).toBeVisible();
});
