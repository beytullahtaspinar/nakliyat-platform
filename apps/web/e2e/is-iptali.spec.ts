import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { uploadRequiredDocuments } from "./belgeler";
import { TEST_CODE } from "./dogrulama";

// Anlaşılan iş müşteri tarafından gerekçeyle iptal edilir; firma işi ve gerekçeyi panelinde görür.
// Hazırlık API'den, akış tarayıcıdan.
const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
const PASSWORD = "iptal-sifre-1234";

const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function verifiedUser(request: APIRequestContext, role: "CUSTOMER" | "COMPANY", fullName: string, phone: string) {
  const reg = await request.post(`${API}/auth/register`, {
    data: { role, fullName, phone, password: PASSWORD, email: `iptal${phone}@test.local`, termsVersion: "2026-10-01" },
  });
  expect(reg.ok()).toBeTruthy();
  const { accessToken } = await reg.json();
  const headers = { Authorization: `Bearer ${accessToken}` };
  expect((await request.post(`${API}/auth/verification/email/confirm`, { headers, data: { code: TEST_CODE } })).ok()).toBeTruthy();
  return headers;
}

async function login(page: Page, phone: string) {
  await page.goto("/giris");
  await page.getByLabel("Cep telefonu").fill(phone);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
}

test("müşteri anlaşılan işi gerekçeyle iptal eder, firma panelinde iptal ve gerekçe görünür", async ({ page, request, browser }) => {
  test.setTimeout(90_000);
  const adminPhone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: adminPhone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "İptal Yönetici" },
  });
  const admin = await request.post(`${API}/auth/login`, { data: { phone: adminPhone, password: PASSWORD } });
  const adminHeaders = { Authorization: `Bearer ${(await admin.json()).accessToken}` };

  const companyPhone = `0534${uniqueDigits(7)}`;
  const companyName = `İptal Nakliyat ${uniqueDigits(5)}`;
  const company = await verifiedUser(request, "COMPANY", "Firma Yetkilisi", companyPhone);
  const profile = await request.post(`${API}/company/profile`, {
    headers: company,
    data: { displayName: companyName, legalName: `${companyName} Ltd.`, taxNumber: uniqueDigits(10).replace(/^0/, "1"), cityCode: "61", serviceCityCodes: ["61"] },
  });
  const companyId = (await profile.json()).id;
  await uploadRequiredDocuments(request, company.Authorization.slice(7));
  const docs = await (await request.get(`${API}/admin/companies/${companyId}`, { headers: adminHeaders })).json();
  for (const doc of docs.documents) {
    expect((await request.post(`${API}/admin/companies/${companyId}/documents/${doc.id}/approve`, { headers: adminHeaders })).ok()).toBeTruthy();
  }
  expect((await request.post(`${API}/admin/companies/${companyId}/verify`, { headers: adminHeaders })).ok()).toBeTruthy();

  const customerPhone = `0532${uniqueDigits(7)}`;
  const customer = await verifiedUser(request, "CUSTOMER", "Ayşe Vazgeçen", customerPhone);
  const moveDate = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  const created = await request.post(`${API}/requests`, {
    headers: customer,
    data: {
      fromCityCode: "61", fromDistrict: "ortahisar", fromAddress: "İptal Sok. No:1", fromFloor: 1, fromHasElevator: false,
      toCityCode: "61", toDistrict: "akcaabat", toAddress: "İptal Sok. No:2", toFloor: 2, toHasElevator: true,
      homeType: "ONE_PLUS_ONE", moveDate,
    },
  });
  const requestId = (await created.json()).id;
  const quote = await request.post(`${API}/company/requests/${requestId}/quotes`, {
    headers: company,
    data: { priceTry: 9000, crewSize: 2, vehicleType: "KAMYONET" },
  });
  expect(quote.ok()).toBeTruthy();
  expect((await request.post(`${API}/quotes/${(await quote.json()).id}/accept`, { headers: customer })).ok()).toBeTruthy();

  // Müşteri işi gerekçeyle iptal eder
  await login(page, customerPhone);
  await expect(page).toHaveURL(/\/hesabim$/);
  await page.goto(`/hesabim/talepler/${requestId}`);
  await expect(page.getByRole("heading", { name: "Taşıman planlandı" })).toBeVisible();
  await page.getByRole("button", { name: "İşi iptal et" }).click();
  await page.getByLabel("İptal nedeni").fill("Ev sahibi çıkışı bir ay erteledi.");
  await expectAccessible(page);
  await page.getByRole("button", { name: "Evet, iptal et" }).click();
  await expect(page.getByRole("heading", { name: "Taşıma iptal edildi" })).toBeVisible();
  await expect(page.getByText("İptal nedeni: Ev sahibi çıkışı bir ay erteledi.")).toBeVisible();
  await expect(page.getByRole("button", { name: "İşi iptal et" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "yeni bir talep oluştur" })).toHaveAttribute("href", "/talep-olustur");

  // Firma işi iptal edilmiş olarak ve gerekçesiyle görür
  const companyContext = await browser.newContext();
  const companyPage = await companyContext.newPage();
  await login(companyPage, companyPhone);
  await expect(companyPage).toHaveURL(/\/firma-paneli$/);
  await companyPage.goto("/firma-paneli/isler");
  await expect(companyPage.getByText("İptal edildi")).toBeVisible();
  await expect(companyPage.getByText("Ev sahibi çıkışı bir ay erteledi.")).toBeVisible();
  await expect(companyPage.getByRole("button", { name: "İşi iptal et" })).toHaveCount(0);
  await expectAccessible(companyPage);
  await companyContext.close();
});
