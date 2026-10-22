import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { uploadRequiredDocuments } from "./belgeler";
import { moveDayWasDaysAgo } from "./db";
import { TEST_CODE } from "./dogrulama";

// Taşınma günü geçen iş: kendiliğinden tamamlanma tarihi görünür, müşteri "taşınma yapılmadı" der,
// firma itirazı görür, yönetim İtirazlar ekranında karar verir. Hazırlık API'den, akış tarayıcıdan.
const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
const PASSWORD = "itiraz-sifre-1234";

const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function verifiedUser(request: APIRequestContext, role: "CUSTOMER" | "COMPANY", fullName: string, phone: string) {
  const reg = await request.post(`${API}/auth/register`, {
    data: { role, fullName, phone, password: PASSWORD, email: `itiraz${phone}@test.local`, termsVersion: "2026-10-01" },
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

test("müşteri taşınma yapılmadı der, firma itirazı görür, yönetim karar verir ve iş tamamlanır", async ({ page, request, browser }) => {
  test.setTimeout(120_000);
  const adminPhone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: adminPhone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "İtiraz Yönetici" },
  });
  const admin = await request.post(`${API}/auth/login`, { data: { phone: adminPhone, password: PASSWORD } });
  const adminHeaders = { Authorization: `Bearer ${(await admin.json()).accessToken}` };

  const companyPhone = `0534${uniqueDigits(7)}`;
  const companyName = `İtiraz Nakliyat ${uniqueDigits(5)}`;
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
  for (const vehicle of docs.vehicles) {
    expect((await request.post(`${API}/admin/companies/${companyId}/vehicles/${vehicle.id}/approve`, { headers: adminHeaders })).ok()).toBeTruthy();
  }
  expect((await request.post(`${API}/admin/companies/${companyId}/verify`, { headers: adminHeaders })).ok()).toBeTruthy();

  const customerPhone = `0532${uniqueDigits(7)}`;
  const customerName = `Ayşe İtirazcı ${uniqueDigits(4)}`;
  const customer = await verifiedUser(request, "CUSTOMER", customerName, customerPhone);
  const moveDate = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  const created = await request.post(`${API}/requests`, {
    headers: customer,
    data: {
      fromCityCode: "61", fromDistrict: "ortahisar", fromAddress: "İtiraz Sok. No:1", fromFloor: 1, fromHasElevator: false,
      toCityCode: "61", toDistrict: "akcaabat", toAddress: "İtiraz Sok. No:2", toFloor: 2, toHasElevator: true,
      homeType: "ONE_PLUS_ONE", moveDate,
    },
  });
  const requestId = (await created.json()).id;
  const quote = await request.post(`${API}/company/requests/${requestId}/quotes`, {
    headers: company,
    data: { priceTry: 9000, crewSize: 2, vehicleType: "KAMYONET" },
  });
  expect(quote.ok()).toBeTruthy();
  const accepted = await request.post(`${API}/quotes/${(await quote.json()).id}/accept`, { headers: customer });
  const bookingId = (await accepted.json()).booking.id as string;
  moveDayWasDaysAgo(bookingId, 1);

  // Müşteri: taşınma dündü; kendiliğinden tamamlanma tarihi ve iki seçenek görünür
  await login(page, customerPhone);
  await expect(page).toHaveURL(/\/hesabim$/);
  await page.goto(`/hesabim/talepler/${requestId}`);
  await expect(page.getByText(/tarihinde kendiliğinden tamamlanır/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Taşınma tamamlandı" })).toBeVisible();
  await expect(page.getByRole("button", { name: "İşi iptal et" })).toHaveCount(0);
  await page.getByRole("button", { name: "Taşınma yapılmadı" }).click();
  await page.getByLabel("Ne oldu?").fill("Firma taşınma günü gelmedi, telefonu da açmadı.");
  await expectAccessible(page);
  await page.getByRole("button", { name: "İtirazı gönder" }).click();
  await expect(page.getByText(/Taşınmanın yapılmadığını bildirdin/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Taşınma tamamlandı" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Taşınma yapılmadı" })).toHaveCount(0);

  // Firma: itirazı görür, işi tamamlayamaz
  const companyContext = await browser.newContext();
  const companyPage = await companyContext.newPage();
  await login(companyPage, companyPhone);
  await expect(companyPage).toHaveURL(/\/firma-paneli$/);
  await companyPage.goto(`/firma-paneli/isler/${bookingId}`);
  await expect(companyPage.getByText(/Müşteri taşınmanın yapılmadığını bildirdi/)).toBeVisible();
  await expect(companyPage.getByRole("button", { name: "İş tamamlandı" })).toHaveCount(0);
  await expectAccessible(companyPage);
  await companyContext.close();

  // Yönetim: İtirazlar ekranında "taşınma yapıldı" kararı
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, adminPhone);
  await expect(adminPage).toHaveURL(/\/yonetim$/);
  await adminPage.goto("/yonetim/itirazlar");
  const row = adminPage.getByRole("row").filter({ hasText: customerName });
  await expect(row.getByText("Firma taşınma günü gelmedi, telefonu da açmadı.")).toBeVisible();
  await expectAccessible(adminPage);
  await row.getByRole("button", { name: "Karar ver" }).click();
  const dialog = adminPage.getByRole("dialog", { name: "İtiraza karar ver" });
  await dialog.getByText("Taşınma yapıldı", { exact: true }).click();
  await dialog.getByLabel("Açıklama").fill("Firma teslim fotoğraflarını gönderdi, müşteri de doğruladı.");
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(dialog).toBeHidden();
  await expect(adminPage.getByRole("row").filter({ hasText: customerName })).toHaveCount(0);
  await adminContext.close();

  // Müşteri: iş tamamlandı, karar görünür, değerlendirme açılır
  await page.reload();
  await expect(page.getByRole("heading", { name: "Taşıman tamamlandı" })).toBeVisible();
  await expect(page.getByText(/Firma teslim fotoğraflarını gönderdi, müşteri de doğruladı\./)).toBeVisible();
  await expect(page.locator("#degerlendirme")).toBeVisible();
});
