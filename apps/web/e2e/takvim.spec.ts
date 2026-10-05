import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { uploadRequiredDocuments } from "./belgeler";
import { TEST_CODE } from "./dogrulama";

// Firma takvimi: kabul edilen iş ay ve hafta görünümünde görünür. Hazırlık API'den.
const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
const PASSWORD = "takvim-sifre-123";

const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

/** E-postası doğrulanmış hesap açar, erişim anahtarını döner */
async function verifiedUser(request: APIRequestContext, role: "CUSTOMER" | "COMPANY", fullName: string, phone: string) {
  const reg = await request.post(`${API}/auth/register`, {
    data: { role, fullName, phone, password: PASSWORD, email: `takvim${phone}@test.local`, termsVersion: "2026-10-01" },
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

test("firma kabul edilen işi takviminde görür", async ({ page, request }) => {
  const adminPhone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: adminPhone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "Takvim Yönetici" },
  });
  const admin = await request.post(`${API}/auth/login`, { data: { phone: adminPhone, password: PASSWORD } });
  const adminHeaders = { Authorization: `Bearer ${(await admin.json()).accessToken}` };

  const companyPhone = `0534${uniqueDigits(7)}`;
  const companyName = `Takvim Nakliyat ${uniqueDigits(5)}`;
  const company = await verifiedUser(request, "COMPANY", "Firma Yetkilisi", companyPhone);
  const profile = await request.post(`${API}/company/profile`, {
    headers: company,
    data: { displayName: companyName, legalName: `${companyName} Ltd.`, taxNumber: uniqueDigits(10).replace(/^0/, "1"), cityCode: "35", serviceCityCodes: ["35"] },
  });
  const companyId = (await profile.json()).id;
  await uploadRequiredDocuments(request, company.Authorization.slice(7));
  const docs = await (await request.get(`${API}/admin/companies/${companyId}`, { headers: adminHeaders })).json();
  for (const doc of docs.documents) {
    expect((await request.post(`${API}/admin/companies/${companyId}/documents/${doc.id}/approve`, { headers: adminHeaders })).ok()).toBeTruthy();
  }
  expect((await request.post(`${API}/admin/companies/${companyId}/verify`, { headers: adminHeaders })).ok()).toBeTruthy();

  const customer = await verifiedUser(request, "CUSTOMER", "Zeynep Takvimli", `0532${uniqueDigits(7)}`);
  const moveDate = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const created = await request.post(`${API}/requests`, {
    headers: customer,
    data: {
      fromCityCode: "35", fromDistrict: "karsiyaka", fromAddress: "Takvim Sok. No:1", fromFloor: 1, fromHasElevator: false,
      toCityCode: "35", toDistrict: "bornova", toAddress: "Takvim Sok. No:2", toFloor: 2, toHasElevator: true,
      homeType: "TWO_PLUS_ONE", moveDate,
    },
  });
  const quote = await request.post(`${API}/company/requests/${(await created.json()).id}/quotes`, {
    headers: company,
    data: { priceTry: 9500, crewSize: 2, vehicleType: "KAMYONET" },
  });
  expect((await request.post(`${API}/quotes/${(await quote.json()).id}/accept`, { headers: customer })).ok()).toBeTruthy();

  await login(page, companyPhone);
  await expect(page).toHaveURL(/\/firma-paneli$/);
  await page.getByRole("link", { name: "Takvim", exact: true }).click();
  await expect(page).toHaveURL(/\/firma-paneli\/takvim$/);
  await page.goto(`/firma-paneli/takvim?ay=${moveDate.slice(0, 7)}`);

  // Ayın listesi her ekranda görünür; iş, mesajlaşma/ayrıntı sayfasına götürür
  const list = page.getByRole("region", { name: "Ayın işleri" });
  await expect(list.getByText("Karşıyaka → Bornova")).toBeVisible();
  await expect(list.getByText("Zeynep Takvimli", { exact: false })).toBeVisible();
  await expect(page.getByText("Taşınmadan bir gün önce sana ve müşteriye hatırlatma gider.", { exact: false })).toBeVisible();
  await expectAccessible(page);

  await page.getByRole("link", { name: "Hafta", exact: true }).click();
  await expect(page).toHaveURL(/gorunum=hafta/);
  await expectAccessible(page);

  await page.goto(`/firma-paneli/takvim?ay=${moveDate.slice(0, 7)}`);
  await list.getByText("Karşıyaka → Bornova").click();
  await expect(page).toHaveURL(/\/firma-paneli\/isler\/[a-z0-9]+$/);
});
