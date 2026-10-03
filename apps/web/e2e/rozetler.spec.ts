import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { uploadRequiredDocuments } from "./belgeler";
import { TEST_CODE } from "./dogrulama";

// Firma rozetleri: belgeleri onaylı firma, müşterinin teklif listesinde, firma sayfasında ve
// firma panelinde rozetle görünür; panel diğer rozetler için ne eksik olduğunu söyler.
const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
const PASSWORD = "rozet-sifre-1234";

const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function verifiedUser(request: APIRequestContext, role: "CUSTOMER" | "COMPANY", fullName: string, phone: string) {
  const reg = await request.post(`${API}/auth/register`, {
    data: { role, fullName, phone, password: PASSWORD, email: `rozet${phone}@test.local`, termsVersion: "2026-10-01" },
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

test("belgeleri onaylı firma teklif listesinde, firma sayfasında ve panelde rozetle görünür", async ({ page, request, browser }) => {
  test.setTimeout(90_000);
  const adminPhone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: adminPhone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "Rozet Yönetici" },
  });
  const admin = await request.post(`${API}/auth/login`, { data: { phone: adminPhone, password: PASSWORD } });
  const adminHeaders = { Authorization: `Bearer ${(await admin.json()).accessToken}` };

  const companyPhone = `0534${uniqueDigits(7)}`;
  const companyName = `Rozet Nakliyat ${uniqueDigits(5)}`;
  const company = await verifiedUser(request, "COMPANY", "Firma Yetkilisi", companyPhone);
  const profile = await request.post(`${API}/company/profile`, {
    headers: company,
    data: { displayName: companyName, legalName: `${companyName} Ltd.`, taxNumber: uniqueDigits(10).replace(/^0/, "1"), cityCode: "16", serviceCityCodes: ["16"] },
  });
  const companyId = (await profile.json()).id;
  await uploadRequiredDocuments(request, company.Authorization.slice(7));
  const docs = await (await request.get(`${API}/admin/companies/${companyId}`, { headers: adminHeaders })).json();
  for (const doc of docs.documents) {
    expect((await request.post(`${API}/admin/companies/${companyId}/documents/${doc.id}/approve`, { headers: adminHeaders })).ok()).toBeTruthy();
  }
  expect((await request.post(`${API}/admin/companies/${companyId}/verify`, { headers: adminHeaders })).ok()).toBeTruthy();

  const customerPhone = `0532${uniqueDigits(7)}`;
  const customer = await verifiedUser(request, "CUSTOMER", "Rozet Müşteri", customerPhone);
  const created = await request.post(`${API}/requests`, {
    headers: customer,
    data: {
      fromCityCode: "16", fromDistrict: "nilufer", fromAddress: "Rozet Sok. No:1", fromFloor: 1, fromHasElevator: false,
      toCityCode: "16", toDistrict: "osmangazi", toAddress: "Rozet Sok. No:2", toFloor: 2, toHasElevator: true,
      homeType: "TWO_PLUS_ONE", moveDate: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
    },
  });
  const requestId = (await created.json()).id;
  expect(
    (await request.post(`${API}/company/requests/${requestId}/quotes`, { headers: company, data: { priceTry: 12000, crewSize: 3, vehicleType: "KAMYON" } })).ok(),
  ).toBeTruthy();

  // Müşteri teklif listesinde rozeti ve açıklamasını görür
  await login(page, customerPhone);
  await expect(page).toHaveURL(/\/hesabim$/);
  await page.goto(`/hesabim/talepler/${requestId}`);
  const badges = page.getByRole("list", { name: "Firma rozetleri" });
  await expect(badges.getByText("Belgeleri onaylı")).toBeVisible();
  await expect(badges.getByText("Hızlı yanıt")).toHaveCount(0);
  await page.getByText("Rozetler ne anlama geliyor?").click();
  await expect(page.getByText("En az 5 müşteri yorumunda ortalama 4,5 ve üzeri puan aldı.")).toBeVisible();
  await expectAccessible(page);

  // Herkese açık firma sayfası
  await page.getByRole("link", { name: companyName }).click();
  await expect(page.getByRole("heading", { level: 1, name: companyName })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rozetler" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Firma rozetleri" }).getByText("Belgeleri onaylı")).toBeVisible();
  await expectAccessible(page);

  // Firma paneli: kazanılan rozet başlıkta, ilerleme Değerlendirmeler sayfasında
  const companyContext = await browser.newContext();
  const companyPage = await companyContext.newPage();
  await login(companyPage, companyPhone);
  await expect(companyPage).toHaveURL(/\/firma-paneli$/);
  await companyPage.getByRole("link", { name: "Rozetlerin" }).click();
  await expect(companyPage).toHaveURL(/\/firma-paneli\/degerlendirmeler#rozetler$/);
  const card = companyPage.locator("#rozetler");
  await expect(card.getByText("Zorunlu belgelerin onaylı ve geçerli.")).toBeVisible();
  await expect(card.getByText(/Son 90 günde 1 teklif verdin; rozet için en az 5 teklif gerekir/)).toBeVisible();
  await expect(card.getByText(/Henüz yorum yok; en az 5 yorumda 4,5 ortalama gerekir/)).toBeVisible();
  await expectAccessible(companyPage);
  await companyContext.close();
});
