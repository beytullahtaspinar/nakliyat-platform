import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Yönetim: bekleyen firmayı inceler ve onaylar. Admin hesabı, canlıdaki gibi komut satırından açılır.
const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
const PASSWORD = "yonetici-sifre-123";

const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

test("yönetici bekleyen firmayı inceler ve onaylar", async ({ page, request }) => {
  const adminPhone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: adminPhone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "Test Yönetici" },
  });

  // Onay bekleyen bir firma
  const companyName = `Deneme Nakliyat ${uniqueDigits(5)}`;
  const reg = await request.post(`${API}/auth/register`, {
    data: { role: "COMPANY", fullName: "Firma Yetkilisi", phone: `0534${uniqueDigits(7)}`, password: PASSWORD },
  });
  expect(reg.ok()).toBeTruthy();
  const { accessToken } = await reg.json();
  const profile = await request.post(`${API}/company/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      displayName: companyName,
      legalName: `${companyName} Ltd. Şti.`,
      taxNumber: uniqueDigits(10).replace(/^0/, "1"),
      k3LicenseNumber: "K3.34.123456",
      cityCode: "34",
      serviceCityCodes: ["34"],
    },
  });
  expect(profile.ok()).toBeTruthy();

  await page.goto("/giris");
  await page.getByLabel("Cep telefonu").fill(adminPhone);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/yonetim$/);
  await expect(page.getByRole("heading", { level: 1, name: "Özet" })).toBeVisible();
  await expectAccessible(page);

  await page.getByRole("link", { name: "Firmalar", exact: true }).click();
  await page.getByRole("link", { name: companyName }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(companyName);
  await expect(page.getByText("K3.34.123456")).toBeVisible();
  await expectAccessible(page);

  await page.getByRole("button", { name: "Firmayı onayla" }).click();
  await page.getByRole("button", { name: "Evet, onayla" }).click();
  await expect(page.getByRole("status")).toContainText("Firma onaylandı");
  await expect(page.getByRole("heading", { name: "Karar geçmişi" })).toBeVisible();
  await expect(page.getByText("Onaylı", { exact: true }).first()).toBeVisible();
});

test("yönetim sayfaları girişsiz açılmaz", async ({ page }) => {
  await page.goto("/yonetim/firmalar");
  await expect(page).toHaveURL(/\/giris\?next=%2Fyonetim|\/giris\?next=\/yonetim/);
});
