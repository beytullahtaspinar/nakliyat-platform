import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Kartla kredi yükleme: sahte iyzico (e2e/iyzico-mock.mjs) ödeme sayfasıyla başarılı ve reddedilen ödeme.
// Kart ayarı ortak kayıtta; havale testi de aynı değeri (açık) yazar.
const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
const PASSWORD = "kart-sifre-1234";

const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function login(page: Page, phone: string) {
  await page.goto("/giris");
  await page.getByLabel("Cep telefonu").fill(phone);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
}

test("firma kartla öder, kredi hemen yüklenir; reddedilen ödemede kredi yüklenmez", async ({ page, browser, request }) => {
  test.setTimeout(120_000);
  const adminPhone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: adminPhone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "Kart Yönetici" },
  });
  const admin = await request.post(`${API}/auth/login`, { data: { phone: adminPhone, password: PASSWORD } });
  const adminHeaders = { Authorization: `Bearer ${(await admin.json()).accessToken}` };
  expect((await request.patch(`${API}/admin/credits/settings`, { headers: adminHeaders, data: { cardEnabled: true } })).ok()).toBeTruthy();

  const companyPhone = `0534${uniqueDigits(7)}`;
  const name = `Kart Nakliyat ${uniqueDigits(5)}`;
  const reg = await request.post(`${API}/auth/register`, {
    data: { role: "COMPANY", fullName: "Kart Yetkilisi", phone: companyPhone, password: PASSWORD, email: `kart${companyPhone}@test.local`, termsVersion: "2026-10-01" },
  });
  const company = { Authorization: `Bearer ${(await reg.json()).accessToken}` };
  expect(
    (
      await request.post(`${API}/company/profile`, {
        headers: company,
        data: { displayName: name, legalName: `${name} Ltd. Şti.`, taxNumber: uniqueDigits(10).replace(/^0/, "1"), cityCode: "64", serviceCityCodes: ["64"] },
      })
    ).ok(),
  ).toBeTruthy();

  // Firma: tutar seçer, iyzico sayfasında öder, kredi sayfasına döner
  await login(page, companyPhone);
  await expect(page).toHaveURL(/\/firma-paneli/);
  await page.goto("/firma-paneli/kredi");
  const section = page.getByRole("region", { name: "Kartla kredi yükle" });
  await section.getByRole("button", { name: "2.500 TL" }).click();
  await expect(section.getByRole("button", { name: "2.500 TL" })).toHaveAttribute("aria-pressed", "true");
  await expect(section.getByText("Ödeme sonrası hemen 2.500 kredi yüklenir.")).toBeVisible();
  await expectAccessible(page);
  await section.getByRole("button", { name: "Kartla öde" }).click();
  await expect(page.getByRole("heading", { name: "Sahte iyzico ödeme sayfası" })).toBeVisible();
  await expect(page.getByText("Tutar: 2500.00 TL")).toBeVisible();
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page).toHaveURL(/\/firma-paneli\/kredi\?odeme=/);
  await expect(page.getByText("Ödemen alındı.", { exact: false })).toBeVisible();
  await expect(page.getByText("2.500 kredi", { exact: true })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Kartla ödeme 2.500,00 TL" })).toContainText("+2.500");
  await expectAccessible(page);

  // Reddedilen ödeme
  await section.getByLabel("Tutar (TL, KDV dahil)").fill("500");
  await section.getByRole("button", { name: "Kartla öde" }).click();
  await page.getByRole("button", { name: "Reddet" }).click();
  await expect(page).toHaveURL(/\/firma-paneli\/kredi\?odeme=/);
  await expect(page.getByRole("alert").filter({ hasText: "Ödeme alınamadı." })).toContainText("Kart limiti yetersiz");
  await expect(page.getByText("2.500 kredi", { exact: true })).toBeVisible();

  // Yönetim: kart ödemeleri listesi
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, adminPhone);
  await expect(adminPage).toHaveURL(/\/yonetim$/);
  await adminPage.goto(`/yonetim/krediler/kart-odemeleri?ara=${encodeURIComponent(name)}`);
  await expect(adminPage.getByRole("heading", { level: 1, name: "Kart ödemeleri" })).toBeVisible();
  const rows = adminPage.getByRole("row").filter({ hasText: name });
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: "Başarılı" })).toContainText("2.500 kredi");
  await expect(rows.filter({ hasText: "Başarısız" })).toContainText("Kart limiti yetersiz");
  await expectAccessible(adminPage);
  await adminContext.close();
});
