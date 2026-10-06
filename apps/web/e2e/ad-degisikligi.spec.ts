import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { uploadRequiredDocuments } from "./belgeler";
import { TEST_CODE } from "./dogrulama";

// Onaylı firmanın görünen ad değişikliği yönetim onayına düşer; firma sayfasında resmi unvan hep görünür.
const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
const PASSWORD = "ad-sifre-1234";

const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);
const slugOf = (name: string) => name.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/\s+/g, "-");

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

test("onaylı firmanın yeni adı yönetim onayından sonra yayına girer", async ({ page, browser, request }) => {
  test.setTimeout(120_000);
  const adminPhone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: adminPhone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "Ad Yönetici" },
  });
  const admin = await request.post(`${API}/auth/login`, { data: { phone: adminPhone, password: PASSWORD } });
  const adminHeaders = { Authorization: `Bearer ${(await admin.json()).accessToken}` };

  const companyPhone = `0534${uniqueDigits(7)}`;
  const suffix = uniqueDigits(5);
  const oldName = `Eski Ad Nakliyat ${suffix}`;
  const newName = `Yeni Ad Nakliyat ${suffix}`;
  const legalName = `Ad Deneme Taşımacılık Ltd. Şti. ${suffix}`;
  const reg = await request.post(`${API}/auth/register`, {
    data: { role: "COMPANY", fullName: "Ad Yetkilisi", phone: companyPhone, password: PASSWORD, email: `ad${companyPhone}@test.local`, termsVersion: "2026-10-01" },
  });
  const company = { Authorization: `Bearer ${(await reg.json()).accessToken}` };
  expect((await request.post(`${API}/auth/verification/email/confirm`, { headers: company, data: { code: TEST_CODE } })).ok()).toBeTruthy();
  const profile = await request.post(`${API}/company/profile`, {
    headers: company,
    data: { displayName: oldName, legalName, taxNumber: uniqueDigits(10).replace(/^0/, "1"), cityCode: "08", serviceCityCodes: ["08"] },
  });
  const companyId = (await profile.json()).id as string;
  await uploadRequiredDocuments(request, company.Authorization.slice(7));
  const docs = await (await request.get(`${API}/admin/companies/${companyId}`, { headers: adminHeaders })).json();
  for (const doc of docs.documents) {
    expect((await request.post(`${API}/admin/companies/${companyId}/documents/${doc.id}/approve`, { headers: adminHeaders })).ok()).toBeTruthy();
  }
  expect((await request.post(`${API}/admin/companies/${companyId}/verify`, { headers: adminHeaders })).ok()).toBeTruthy();

  // Firma: unvan salt okunur, yeni ad onaya düşer
  await login(page, companyPhone);
  await expect(page).toHaveURL(/\/firma-paneli$/);
  await page.goto("/firma-paneli/profil");
  await expect(page.getByText(legalName)).toBeVisible();
  await expect(page.getByLabel("Ticari unvan")).toHaveCount(0);
  await expect(page.getByText("kalan hakkın: 2")).toBeVisible();
  await page.getByLabel("Görünen ad").fill(newName);
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText(`“${newName}” adı onay bekliyor`)).toBeVisible();
  await expect(page.getByLabel("Görünen ad")).toHaveValue(newName);
  await expectAccessible(page);

  // Onaylanana kadar eski ad yayında, resmi unvan başlığın altında
  await page.goto(`/firmalar/${slugOf(oldName)}-${companyId}`);
  await expect(page.getByRole("heading", { level: 1, name: oldName })).toBeVisible();
  await expect(page.getByText(legalName)).toBeVisible();

  // Yönetim: menü sayacı ve onay
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, adminPhone);
  await expect(adminPage).toHaveURL(/\/yonetim$/);
  await adminPage.goto("/yonetim/ad-degisiklikleri");
  await expect(adminPage.getByRole("heading", { level: 1, name: "Ad değişiklikleri" })).toBeVisible();
  const row = adminPage.getByRole("row", { name: new RegExp(newName) });
  await expect(row.getByText(legalName)).toBeVisible();
  await expectAccessible(adminPage);
  await row.getByRole("button", { name: "Onayla" }).click();
  await row.getByRole("button", { name: "Evet, onayla" }).click();
  // Karar verilen talep onay bekleyenlerden çıkar, onaylılar sekmesinde görünür
  await expect(row).toHaveCount(0);
  await adminPage.getByRole("link", { name: "Onaylı", exact: true }).click();
  await expect(adminPage.getByRole("row", { name: new RegExp(newName) }).getByText("Onaylandı")).toBeVisible();
  await adminContext.close();

  // Yeni ad yayında; eski adres de açılır ama kanonik adres yeni addır
  for (const name of [oldName, newName]) {
    await page.goto(`/firmalar/${slugOf(name)}-${companyId}`);
    await expect(page.getByRole("heading", { level: 1, name: newName })).toBeVisible();
    await expect(page.getByText(legalName)).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/firmalar/${slugOf(newName)}-${companyId}$`));
  }

  await page.goto("/firma-paneli/profil");
  await expect(page.getByText("kalan hakkın: 1")).toBeVisible();
  await expect(page.getByText("onay bekliyor")).toHaveCount(0);
});
