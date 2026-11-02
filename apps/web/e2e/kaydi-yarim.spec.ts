import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Firma olarak kayıt olup firma bilgilerini girmeyen hesap: panelde adım rehberi, yönetimde liste ve hatırlatma.
const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
const PASSWORD = "yonetici-sifre-123";
const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);
/** Ekran görüntüleri yalnızca istenirse kaydedilir (SCREENSHOT_DIR) */
const shot = async (page: Page, name: string, project: string) => {
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/${name}-${project}.png`, fullPage: true });
};

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}
async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}
async function login(page: Page, phone: string) {
  await page.goto("/giris");
  await page.getByLabel("Cep telefonu").fill(phone);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
}

test("kaydı yarım firma: panelde adımlar, yönetimde liste ve hatırlatma", async ({ browser, request }, testInfo) => {
  const project = testInfo.project.name === "mobil" ? "mobil" : "masaustu";
  const fullName = `Yarım Firma ${uniqueDigits(5)}`;
  const phone = `0535${uniqueDigits(7)}`;
  const reg = await request.post(`${API}/auth/register`, { data: { role: "COMPANY", fullName, phone, password: PASSWORD } });
  expect(reg.ok()).toBeTruthy();

  // Firma tarafı: ilk ekranda firma bilgileri formu ve kalan adımlar
  const companyPage = await (await browser.newContext(testInfo.project.use)).newPage();
  await login(companyPage, phone);
  await expect(companyPage).toHaveURL(/\/firma-paneli$/);
  const steps = companyPage.getByRole("navigation", { name: "Firma kaydı adımları" });
  await expect(steps.getByText("Firma kaydı: 0/4 adım tamam")).toBeVisible();
  await expect(steps.locator('[aria-current="step"]')).toContainText("Firma bilgileri");
  await expectNoHorizontalScroll(companyPage);
  await expectAccessible(companyPage);
  await shot(companyPage, "1-firma-paneli-adimlar", project);
  await companyPage.close();

  // Yönetim tarafı
  const adminPhone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: adminPhone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "Test Yönetici" },
  });
  const page = await (await browser.newContext(testInfo.project.use)).newPage();
  await login(page, adminPhone);
  await expect(page).toHaveURL(/\/yonetim$/);
  await page.getByRole("link", { name: /Kaydı yarım firma/ }).click();
  await expect(page).toHaveURL(/rol=kaydi-yarim/);
  await page.getByRole("search").getByRole("searchbox").fill(fullName);
  await page.getByRole("search").getByRole("button", { name: "Ara" }).click();
  const row = page.getByRole("row", { name: new RegExp(fullName) });
  await expect(row.getByText("Firma bilgisi yok")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
  await shot(page, "2-yonetim-kaydi-yarim-liste", project);

  await row.getByRole("link", { name: fullName }).click();
  await expect(page.getByRole("heading", { name: "Kaydı yarım kaldı: firma bilgisi yok" })).toBeVisible();
  await expect(page.getByText(`Merhaba ${fullName.split(" ")[0]}, evdenevenakliyat.app'e firma olarak`)).toBeVisible();
  await expect(page.getByRole("link", { name: "WhatsApp ile yaz" })).toHaveAttribute("href", /^https:\/\/wa\.me\/905\d{9}\?text=/);
  await page.getByRole("button", { name: "Hatırlatma gönder" }).click();
  await expect(page.getByText("Hatırlatma gönderildi")).toBeVisible();
  await expect(page.getByText("Kayıt hatırlatması gönderildi")).toBeVisible();
  // 12 saat içinde ikinci hatırlatma gönderilmez
  await page.getByRole("button", { name: "Hatırlatma gönder" }).click();
  await expect(page.getByText(/son 12 saat içinde hatırlatma gitti/)).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
  await shot(page, "3-yonetim-kullanici-hatirlatma", project);
  await page.close();
});
