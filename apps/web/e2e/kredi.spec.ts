import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { uploadRequiredDocuments } from "./belgeler";
import { TEST_CODE } from "./dogrulama";

// Kredi: yönetici firmaya elle kredi ekler, firma bakiyesini ve hareketi görür.
// Kredi sistemi ortak ayardır; paralel testlerdeki teklifler etkilenmesin diye burada açılmaz (kapalı kalır).
const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
const PASSWORD = "kredi-sifre-1234";

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

test("yönetici firmaya kredi ekler, firma bakiyesini ve hareketi görür", async ({ page, browser, request }) => {
  test.setTimeout(120_000);
  const adminPhone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: adminPhone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "Kredi Yönetici" },
  });
  const admin = await request.post(`${API}/auth/login`, { data: { phone: adminPhone, password: PASSWORD } });
  const adminHeaders = { Authorization: `Bearer ${(await admin.json()).accessToken}` };

  const companyPhone = `0534${uniqueDigits(7)}`;
  const name = `Kredi Nakliyat ${uniqueDigits(5)}`;
  const reg = await request.post(`${API}/auth/register`, {
    data: { role: "COMPANY", fullName: "Kredi Yetkilisi", phone: companyPhone, password: PASSWORD, email: `kredi${companyPhone}@test.local`, termsVersion: "2026-10-01" },
  });
  const company = { Authorization: `Bearer ${(await reg.json()).accessToken}` };
  expect((await request.post(`${API}/auth/verification/email/confirm`, { headers: company, data: { code: TEST_CODE } })).ok()).toBeTruthy();
  const profile = await request.post(`${API}/company/profile`, {
    headers: company,
    data: { displayName: name, legalName: `${name} Ltd. Şti.`, taxNumber: uniqueDigits(10).replace(/^0/, "1"), cityCode: "64", serviceCityCodes: ["64"] },
  });
  const companyId = (await profile.json()).id as string;
  await uploadRequiredDocuments(request, company.Authorization.slice(7));
  const docs = await (await request.get(`${API}/admin/companies/${companyId}`, { headers: adminHeaders })).json();
  for (const doc of docs.documents) {
    expect((await request.post(`${API}/admin/companies/${companyId}/documents/${doc.id}/approve`, { headers: adminHeaders })).ok()).toBeTruthy();
  }
  expect((await request.post(`${API}/admin/companies/${companyId}/verify`, { headers: adminHeaders })).ok()).toBeTruthy();

  // Bakiyesi olmayan firma, sistem kapalıyken Kredi menüsünü görmez
  await login(page, companyPhone);
  await expect(page).toHaveURL(/\/firma-paneli$/);
  await expect(page.getByRole("link", { name: "Kredi", exact: true })).toHaveCount(0);

  // Yönetim: firma kaydından kredi ekler
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, adminPhone);
  await expect(adminPage).toHaveURL(/\/yonetim$/);
  await adminPage.goto(`/yonetim/firmalar/${companyId}`);
  await adminPage.getByLabel("Miktar (kredi)").fill("0");
  await adminPage.getByLabel("Gerekçe").fill("Deneme");
  await adminPage.getByRole("button", { name: "Krediyi işle" }).click();
  await expect(adminPage.getByText("Miktar 0 dışında bir tam sayı olmalı")).toBeVisible();
  await adminPage.getByLabel("Miktar (kredi)").fill("300");
  await adminPage.getByLabel("Gerekçe").fill("Pilot firma kredisi");
  await adminPage.getByRole("button", { name: "Krediyi işle" }).click();
  await expect(adminPage.getByText("Eklendi. Yeni bakiye: 300 kredi.")).toBeVisible();
  await expectAccessible(adminPage);

  // Yönetim: kredi panosu ve firma süzgeci
  await adminPage.getByRole("link", { name: "Tüm hareketler" }).click();
  await expect(adminPage).toHaveURL(new RegExp(`/yonetim/krediler\\?firma=${companyId}`));
  await expect(adminPage.getByRole("heading", { level: 1, name: "Krediler" })).toBeVisible();
  const row = adminPage.getByRole("row").filter({ hasText: "Pilot firma kredisi" });
  await expect(row).toContainText(name);
  await expect(row).toContainText("+300");
  await expect(row).toContainText("Kredi Yönetici");
  await expectAccessible(adminPage);

  await adminPage.getByRole("link", { name: "Kredi ayarları" }).click();
  await expect(adminPage.getByLabel("Kredi sistemi açık")).not.toBeChecked();
  await expect(adminPage.getByLabel("Şehir içi teklif (kredi)")).toBeVisible();
  await expectAccessible(adminPage);
  await adminContext.close();

  // Firma: menüde Kredi, bakiye ve hareket
  await page.reload();
  await expect(page.getByRole("link", { name: "Kredi", exact: true }).first()).toBeAttached();
  await page.goto("/firma-paneli/kredi");
  await expect(page.getByText("Teklif vermek şu an ücretsiz.")).toBeVisible();
  await expect(page.getByText("300 kredi", { exact: true })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Pilot firma kredisi" })).toContainText("+300");
  await expectAccessible(page);
});
