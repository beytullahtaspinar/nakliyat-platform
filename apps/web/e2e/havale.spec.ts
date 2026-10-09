import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { uploadRequiredDocuments } from "./belgeler";
import { TEST_CODE } from "./dogrulama";

// Havale/EFT ile kredi yükleme: yönetim banka hesabını tanımlar, firma dekontla bildirir, yönetim tutarı düzeltip onaylar.
// Kredi sistemi (teklifte düşme) kapalı kalır; banka hesabı tanımlamak yalnızca havale bildirimini açar.
const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
const PASSWORD = "havale-sifre-1234";
const IBAN = "TR33 0006 1005 1978 6457 8413 26";

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

test("firma havaleyi dekontla bildirir, yönetim tutarı düzeltip onaylar, kredi yüklenir", async ({ page, browser, request }) => {
  test.setTimeout(150_000);
  const adminPhone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: adminPhone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "Havale Yönetici" },
  });
  const admin = await request.post(`${API}/auth/login`, { data: { phone: adminPhone, password: PASSWORD } });
  const adminHeaders = { Authorization: `Bearer ${(await admin.json()).accessToken}` };

  const companyPhone = `0534${uniqueDigits(7)}`;
  const name = `Havale Nakliyat ${uniqueDigits(5)}`;
  const reg = await request.post(`${API}/auth/register`, {
    data: { role: "COMPANY", fullName: "Havale Yetkilisi", phone: companyPhone, password: PASSWORD, email: `havale${companyPhone}@test.local`, termsVersion: "2026-10-01" },
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

  // Yönetim: banka hesabını tanımlar (geçersiz IBAN önce reddedilir)
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, adminPhone);
  await expect(adminPage).toHaveURL(/\/yonetim$/);
  await adminPage.goto("/yonetim/krediler/ayarlar");
  await expect(adminPage.getByLabel("Kredi sistemi açık")).not.toBeChecked();
  const firstBank = adminPage.getByLabel("1. hesap: banka");
  await firstBank.fill("Ziraat Bankası");
  const holder = adminPage.getByLabel("Hesap sahibi").first();
  await holder.fill("Örnek Nakliyat A.Ş.");
  const iban = adminPage.getByLabel("IBAN").first();
  await iban.fill("TR34 0006 1005 1978 6457 8413 26");
  await adminPage.getByRole("button", { name: "Kaydet" }).click();
  await expect(adminPage.getByText(/IBAN geçersiz/)).toBeVisible();
  await iban.fill(IBAN);
  // Kart ayarı da ortak kayıtta: kart testiyle aynı değeri yazar (paralel testler birbirini bozmasın)
  await adminPage.getByLabel("Kartla ödeme açık (iyzico)").check();
  await adminPage.getByRole("button", { name: "Kaydet" }).click();
  await expect(adminPage.getByText("Kaydedildi. Kredi sistemi kapalı: teklif vermek ücretsiz.")).toBeVisible();
  await expectAccessible(adminPage);

  // Firma: havale kodunu ve hesabı görür, dekontla bildirir
  await login(page, companyPhone);
  await expect(page).toHaveURL(/\/firma-paneli$/);
  await page.goto("/firma-paneli/kredi");
  const section = page.getByRole("region", { name: "Havale/EFT ile kredi yükle" });
  await expect(section.getByText(IBAN)).toBeVisible();
  const code = (await section.getByText(/^EN-[2-9A-Z]{6}$/).textContent())!;
  await expect(section.getByLabel("Gönderen adı ya da unvanı")).toHaveValue(`${name} Ltd. Şti.`);
  await section.getByLabel("Gönderdiğin tutar (TL)").fill("50");
  await section.getByRole("button", { name: "Havale bildirimini gönder" }).click();
  await expect(section.getByText(/En az \d/).last()).toBeVisible();
  await section.getByLabel("Gönderdiğin tutar (TL)").fill("1.500");
  await expect(section.getByText("Onaylanınca 1.500 kredi yüklenir.")).toBeVisible();
  await section.getByLabel(/^Dekont \(isteğe bağlı/).setInputFiles({ name: "dekont.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 sahte-dekont") });
  await section.getByRole("button", { name: "Havale bildirimini gönder" }).click();
  await expect(section.getByText("Bildirimin alındı.", { exact: false })).toBeVisible();
  const ownRow = page.getByRole("table", { name: "Havale bildirimlerin, en yenisi önce" }).getByRole("row").nth(1);
  await expect(ownRow).toContainText("1.500,00");
  await expect(ownRow).toContainText("Onay bekliyor");
  await expectAccessible(page);

  // Yönetim: menü sayacı, havale listesi, tutarı düzeltip onay
  await adminPage.goto("/yonetim/krediler/havaleler");
  await expect(adminPage.getByRole("heading", { level: 1, name: "Havale bildirimleri" })).toBeVisible();
  const row = adminPage.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText(code);
  await expect(row).toContainText("Ziraat Bankası");
  await expect(row.getByRole("link", { name: "Dekont: dekont.pdf" })).toBeVisible();
  await expectAccessible(adminPage);
  await row.getByRole("button", { name: "Onayla" }).click();
  const dialog = adminPage.getByRole("dialog", { name: "Havaleyi onayla" });
  await expect(dialog.getByLabel("Hesaba geçen tutar (TL)")).toHaveValue("1.500");
  await dialog.getByLabel("Hesaba geçen tutar (TL)").fill("1.450");
  await expect(dialog.getByText("1.450 kredi")).toBeVisible();
  await expect(dialog.getByText("Tutar bildirilenden farklı.", { exact: false })).toBeVisible();
  await expectAccessible(adminPage);
  await dialog.getByRole("button", { name: "Onayla ve krediyi yükle" }).click();
  await expect(dialog).toBeHidden();
  await expect(adminPage.getByRole("row").filter({ hasText: name })).toHaveCount(0);

  await adminPage.goto(`/yonetim/krediler/havaleler?durum=onaylanan&ara=${encodeURIComponent(code)}`);
  const approved = adminPage.getByRole("row").filter({ hasText: name });
  await expect(approved).toContainText("Onaylandı");
  await expect(approved).toContainText("+1.450 kredi");
  await expect(approved).toContainText("Havale Yönetici");
  await adminContext.close();

  // Firma: bakiye, hareket ve bildirimin durumu
  await page.reload();
  await expect(page.getByText("1.450 kredi", { exact: true })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Havale/EFT 1.450,00 TL" })).toContainText("+1.450");
  const done = page.getByRole("table", { name: "Havale bildirimlerin, en yenisi önce" }).getByRole("row").nth(1);
  await expect(done).toContainText("Onaylandı");
  await expect(done).toContainText("Bildirilen: ₺1.500,00");
});
