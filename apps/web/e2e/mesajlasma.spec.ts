import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { uploadRequiredDocuments } from "./belgeler";
import { TEST_CODE } from "./dogrulama";

// Teklif kabulünden sonra müşteri ile firma site üzerinden yazışır. Hazırlık API'den, yazışma tarayıcıdan.
const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
const PASSWORD = "mesaj-sifre-123";

const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

/** E-postası doğrulanmış hesap açar, erişim anahtarını döner */
async function verifiedUser(request: APIRequestContext, role: "CUSTOMER" | "COMPANY", fullName: string, phone: string) {
  const reg = await request.post(`${API}/auth/register`, {
    data: { role, fullName, phone, password: PASSWORD, email: `mesaj${phone}@test.local`, termsVersion: "2026-10-01" },
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

test("müşteri ve firma teklif kabulünden sonra mesajlaşır", async ({ page, request, browser }) => {
  // Doğrulanmış firma
  const adminPhone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: adminPhone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "Mesaj Yönetici" },
  });
  const admin = await request.post(`${API}/auth/login`, { data: { phone: adminPhone, password: PASSWORD } });
  const adminHeaders = { Authorization: `Bearer ${(await admin.json()).accessToken}` };

  const companyPhone = `0534${uniqueDigits(7)}`;
  const companyName = `Mesaj Nakliyat ${uniqueDigits(5)}`;
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

  // Müşteri talep açar, firma teklif verir, müşteri kabul eder
  const customerPhone = `0532${uniqueDigits(7)}`;
  const customer = await verifiedUser(request, "CUSTOMER", "Ayşe Mesajcı", customerPhone);
  const moveDate = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const created = await request.post(`${API}/requests`, {
    headers: customer,
    data: {
      fromCityCode: "35", fromDistrict: "karsiyaka", fromAddress: "Mesaj Sok. No:1", fromFloor: 1, fromHasElevator: false,
      toCityCode: "35", toDistrict: "bornova", toAddress: "Yanıt Sok. No:2", toFloor: 2, toHasElevator: true,
      homeType: "TWO_PLUS_ONE", moveDate,
    },
  });
  const requestId = (await created.json()).id;
  const quote = await request.post(`${API}/company/requests/${requestId}/quotes`, {
    headers: company,
    data: { priceTry: 9000, crewSize: 2, vehicleType: "KAMYONET" },
  });
  expect(quote.ok()).toBeTruthy();
  expect((await request.post(`${API}/quotes/${(await quote.json()).id}/accept`, { headers: customer })).ok()).toBeTruthy();

  // Müşteri talep sayfasından firmaya yazar
  await login(page, customerPhone);
  await expect(page).toHaveURL(/\/hesabim$/);
  await page.goto(`/hesabim/talepler/${requestId}#mesajlar`);
  const customerChat = page.locator("#mesajlar");
  await expect(customerChat.getByRole("heading", { name: `${companyName} ile mesajlar` })).toBeVisible();
  await expect(customerChat.getByText("Henüz mesaj yok.", { exact: false })).toBeVisible();
  await customerChat.getByLabel(`${companyName} için mesajın`).fill("Merhaba, sabah 9'da başlayabilir miyiz?");
  await customerChat.getByRole("button", { name: "Gönder" }).click();
  await expect(customerChat.getByRole("listitem").filter({ hasText: "sabah 9'da" })).toBeVisible();
  await expect(customerChat.getByLabel(`${companyName} için mesajın`)).toHaveValue("");
  await expectAccessible(page);

  // Firma panelinde okunmamış mesaj rozeti; konuşmayı açar ve yanıtlar
  const companyContext = await browser.newContext();
  const companyPage = await companyContext.newPage();
  await login(companyPage, companyPhone);
  await expect(companyPage).toHaveURL(/\/firma-paneli$/);
  const nav = companyPage.getByRole("navigation", { name: "Firma paneli" });
  await expect(nav.getByRole("link", { name: "İşlerim 1 yeni mesaj" })).toBeVisible();
  await nav.getByRole("link", { name: /^İşlerim/ }).click();
  await expect(companyPage.getByText("1 yeni mesaj")).toBeVisible();
  await companyPage.getByRole("link", { name: "Müşteriyle mesajlaş" }).click();
  await expect(companyPage.getByRole("heading", { name: "Ayşe Mesajcı ile mesajlar" })).toBeVisible();
  await expect(companyPage.getByText("Merhaba, sabah 9'da başlayabilir miyiz?")).toBeVisible();
  // Okununca menüdeki rozet kalkar
  await expect(nav.getByRole("link", { name: "İşlerim", exact: true })).toBeVisible();
  await companyPage.getByLabel("Ayşe Mesajcı için mesajın").fill("Olur, 9'da kapınızdayız.");
  await companyPage.getByRole("button", { name: "Gönder" }).click();
  await expect(companyPage.getByText("Olur, 9'da kapınızdayız.")).toBeVisible();
  await expectAccessible(companyPage);
  await companyContext.close();

  // Müşteri ekranı kendiliğinden yenilenir: yanıt gelir, kendi mesajı "Görüldü" olur
  await expect(customerChat.getByText("Olur, 9'da kapınızdayız.")).toBeVisible({ timeout: 20_000 });
  await expect(customerChat.getByText("Görüldü", { exact: false })).toBeVisible();
});
