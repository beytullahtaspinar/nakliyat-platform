import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { uploadRequiredDocuments } from "./belgeler";

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
  await uploadRequiredDocuments(request, accessToken);

  await page.goto("/giris");
  await page.getByLabel("Cep telefonu").fill(adminPhone);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/yonetim$/);
  await expect(page.getByRole("heading", { level: 1, name: "Pano" })).toBeVisible();
  // Yönetim paneli tanıtım sitesinin menüsünü ve altbilgisini göstermez
  await expect(page.getByRole("link", { name: "Teklif al" })).toHaveCount(0);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  await expectAccessible(page);

  // Onay bekleyen belgeler ayrı listede, firmaya göre aranır
  await page.getByRole("navigation", { name: "Yönetim" }).getByRole("link", { name: /^Belgeler/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Belgeler" })).toBeVisible();
  await page.getByRole("search").getByRole("searchbox").fill(companyName);
  await page.getByRole("search").getByRole("button", { name: "Ara" }).click();
  await expect(page.getByRole("link", { name: companyName, exact: true })).toHaveCount(3);
  await expect(page.getByText("Yeni belge")).toHaveCount(3);
  await expectAccessible(page);

  await page.getByRole("navigation", { name: "Yönetim" }).getByRole("link", { name: /^Firmalar/ }).click();
  await page.getByRole("search").getByRole("searchbox").fill(companyName);
  await page.getByRole("search").getByRole("button", { name: "Ara" }).click();
  await expectAccessible(page);
  await page.getByRole("link", { name: companyName }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(companyName);
  await expect(page.getByText("K3.34.123456")).toBeVisible();
  await expectAccessible(page);

  // Zorunlu belgeler onaylanmadan firma onaylanamaz
  await expect(page.getByRole("button", { name: "Firmayı onayla" })).toHaveCount(0);
  await expect(page.getByText(/Onay için önce şu belgeler onaylanmalı/)).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Onayla", exact: true }).first().click();
    await page.getByRole("button", { name: "Evet, onayla" }).click();
    // Onay bitince belgenin onay formu kapanır; bir sonrakine ancak o zaman geçilir
    await expect(page.getByRole("button", { name: "Evet, onayla" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Onayla", exact: true })).toHaveCount(2 - i);
  }

  await page.getByRole("button", { name: "Firmayı onayla" }).click();
  await page.getByRole("button", { name: "Evet, onayla" }).click();
  await expect(page.getByRole("status")).toContainText("Firma onaylandı");
  await expect(page.getByRole("heading", { name: "Karar geçmişi" })).toBeVisible();
  await expect(page.getByText("Onaylı", { exact: true }).first()).toBeVisible();
});

test("yönetici kullanıcının bilgilerini ve şifresini değiştirir", async ({ page, request, browser }) => {
  const adminPhone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: adminPhone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "Test Yönetici" },
  });
  const customerPhone = `0536${uniqueDigits(7)}`;
  const reg = await request.post(`${API}/auth/register`, {
    data: { role: "CUSTOMER", fullName: "Eski Ad", phone: customerPhone, password: PASSWORD },
  });
  expect(reg.ok()).toBeTruthy();
  const { user } = await reg.json();

  await page.goto("/giris");
  await page.getByLabel("Cep telefonu").fill(adminPhone);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/yonetim$/);

  await page.goto(`/yonetim/kullanicilar/${user.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Eski Ad");
  await expectAccessible(page);
  await page.getByLabel("Ad soyad").fill("Yeni Ad Soyad");
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Yeni Ad Soyad");

  await page.getByRole("button", { name: "Şifre oluştur" }).click();
  const newPassword = await page.getByLabel("Yeni şifre").inputValue();
  expect(newPassword).toHaveLength(12);
  await page.getByRole("button", { name: "Şifreyi değiştir" }).click();
  await expect(page.getByText(/Yeni şifre kaydedildi/)).toBeVisible();

  // Kullanıcı yeni şifreyle girer
  const context = await browser.newContext();
  const userPage = await context.newPage();
  await userPage.goto("/giris");
  await userPage.getByLabel("Cep telefonu").fill(customerPhone);
  await userPage.getByLabel("Şifre").fill(newPassword);
  await userPage.getByRole("button", { name: "Giriş yap" }).click();
  await expect(userPage).toHaveURL(/\/hesabim/);
  await context.close();
});

test("yönetim sayfaları girişsiz açılmaz", async ({ page }) => {
  await page.goto("/yonetim/firmalar");
  await expect(page).toHaveURL(/\/giris\?next=%2Fyonetim|\/giris\?next=\/yonetim/);
});

test("roller birbirinin ekranına girmez; açık oturumla giriş sayfası hesap değiştirtir", async ({ page, request }) => {
  const adminPhone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: adminPhone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "Test Yönetici" },
  });
  const companyPhone = `0534${uniqueDigits(7)}`;
  const reg = await request.post(`${API}/auth/register`, {
    data: { role: "COMPANY", fullName: "Firma Yetkilisi", phone: companyPhone, password: PASSWORD },
  });
  expect(reg.ok()).toBeTruthy();

  // Firma numarası yöneticiye çevrilemez
  expect(() =>
    execFileSync("node", ["dist/create-admin.js"], {
      cwd: path.resolve(__dirname, "../../api"),
      env: { ...process.env, ADMIN_PHONE: companyPhone, ADMIN_PASSWORD: PASSWORD },
      stdio: "pipe",
    }),
  ).toThrow(/firma hesabına ait/);

  await page.goto("/giris");
  await page.getByLabel("Cep telefonu").fill(adminPhone);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/yonetim$/);

  // Yönetici oturumu açıkken firma girişi/kaydı yönetim paneline götürmez
  await page.goto("/giris");
  await expect(page.getByRole("heading", { level: 1, name: "Zaten giriş yapmışsın" })).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Çıkış yap ve başka hesapla devam et" }).click();
  await expect(page).toHaveURL(/\/giris$/);
  await page.getByLabel("Cep telefonu").fill(companyPhone);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/firma-paneli/);

  // Firma hesabı yönetim ve müşteri ekranlarını açamaz
  await page.goto("/yonetim");
  await expect(page).toHaveURL(/\/firma-paneli/);
  await page.goto("/hesabim");
  await expect(page).toHaveURL(/\/firma-paneli/);
  const api = await request.get(`${API}/admin/summary`, {
    headers: { Authorization: `Bearer ${(await reg.json()).accessToken}` },
  });
  expect(api.status()).toBe(403);
});

test("yönetici hesabı siler", async ({ page, request }) => {
  const adminPhone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: adminPhone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "Test Yönetici" },
  });
  const customerPhone = `0536${uniqueDigits(7)}`;
  const customerName = `Silinecek Müşteri ${uniqueDigits(5)}`;
  const reg = await request.post(`${API}/auth/register`, {
    data: { role: "CUSTOMER", fullName: customerName, phone: customerPhone, password: PASSWORD },
  });
  expect(reg.ok()).toBeTruthy();
  const { user } = await reg.json();

  await page.goto("/giris");
  await page.getByLabel("Cep telefonu").fill(adminPhone);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/yonetim$/);

  await page.goto(`/yonetim/kullanicilar/${user.id}`);
  await page.getByRole("button", { name: "Hesabı sil" }).click();
  await expect(page.getByText("kalıcı olarak silinecek")).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Evet, kalıcı olarak sil" }).click();
  await expect(page).toHaveURL(/\/yonetim\/kullanicilar\?silindi=1/);
  await expect(page.getByRole("status")).toHaveText("Hesap silindi.");
  await expect(page.getByRole("link", { name: customerName })).toHaveCount(0);

  const login = await request.post(`${API}/auth/login`, { data: { phone: customerPhone, password: PASSWORD } });
  expect(login.status()).toBe(401);
});
