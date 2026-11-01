import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { TEST_CODE } from "./dogrulama";

// Müşteri hesabı: panel menüsü, boş durum, hesap bilgileri (ad ve şifre değiştirme)
const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
const PASSWORD = "hesap-sifre-123";
const NEW_PASSWORD = "yeni-hesap-sifre-456";

const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function login(page: Page, phone: string, password: string) {
  await page.goto("/giris");
  await page.getByLabel("Cep telefonu").fill(phone);
  await page.getByLabel("Şifre").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
}

test("müşteri hesabı panel düzeninde açılır; adını ve şifresini değiştirir", async ({ page, request, browser }) => {
  const phone = `0532${uniqueDigits(7)}`;
  const reg = await request.post(`${API}/auth/register`, {
    data: { role: "CUSTOMER", fullName: "Hesap Denemesi", phone, password: PASSWORD, email: `hesap${phone}@test.local`, termsVersion: "2026-10-01" },
  });
  expect(reg.ok()).toBeTruthy();
  const headers = { Authorization: `Bearer ${(await reg.json()).accessToken}` };
  expect((await request.post(`${API}/auth/verification/email/confirm`, { headers, data: { code: TEST_CODE } })).ok()).toBeTruthy();

  await login(page, phone, PASSWORD);
  await expect(page).toHaveURL(/\/hesabim$/);
  await expect(page.getByRole("heading", { level: 1, name: "Merhaba Hesap" })).toBeVisible();
  // Tanıtım sitesinin menüsü yok; hesap menüsü var
  const nav = page.getByRole("navigation", { name: "Hesabım" });
  await expect(nav.getByRole("link", { name: "Taleplerim" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Henüz talebin yok" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Hemen ücretsiz teklif al" })).toHaveAttribute("href", "/talep-olustur");
  // Telefonda sayfa yana kaymaz
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expectAccessible(page);

  await nav.getByRole("link", { name: "Hesap bilgileri" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Hesap bilgileri" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Hesap bilgileri" })).toHaveAttribute("aria-current", "page");
  await expectAccessible(page);

  // Ad düzeltilir; panel başlığı yeni adla yenilenir
  await page.getByLabel("Ad soyad").fill("Hesap  Yeni Ad");
  await page.getByRole("button", { name: "Adı kaydet" }).click();
  await expect(page.getByText("Adın kaydedildi.")).toBeVisible();
  await expect(page.getByLabel("Ad soyad")).toHaveValue("Hesap Yeni Ad");
  await expect(page.getByRole("link", { name: /Hesap Yeni Ad/ }).first()).toBeVisible();

  // Şifre: yanlış şu anki şifre ve uyuşmayan tekrar reddedilir
  const form = page.locator("#sifre");
  await form.getByLabel("Şu anki şifren").fill("yanlis-sifre-000");
  await form.locator("input[name=newPassword]").fill(NEW_PASSWORD);
  await form.getByLabel("Yeni şifre (tekrar)").fill(NEW_PASSWORD);
  await form.getByRole("button", { name: "Şifreyi değiştir" }).click();
  await expect(form.getByRole("alert")).toHaveText("Şu anki şifren hatalı");
  await form.getByLabel("Şu anki şifren").fill(PASSWORD);
  await form.getByLabel("Yeni şifre (tekrar)").fill("baska-sifre-789");
  await form.getByRole("button", { name: "Şifreyi değiştir" }).click();
  await expect(form.getByRole("alert")).toHaveText("Yeni şifreler aynı değil.");
  await form.getByLabel("Yeni şifre (tekrar)").fill(NEW_PASSWORD);
  await form.getByRole("button", { name: "Şifreyi değiştir" }).click();
  await expect(form.getByText(/Şifren değiştirildi/)).toBeVisible();
  await expect(form.getByLabel("Şu anki şifren")).toHaveValue("");

  // Bu cihazda oturum sürer; yeni şifreyle başka cihazdan girilir, eskisiyle girilemez
  await nav.getByRole("link", { name: "Taleplerim" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Merhaba Hesap" })).toBeVisible();
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await login(otherPage, phone, PASSWORD);
  await expect(otherPage.getByText(/hatalı/)).toBeVisible();
  await login(otherPage, phone, NEW_PASSWORD);
  await expect(otherPage).toHaveURL(/\/hesabim$/);
  await other.close();
});
