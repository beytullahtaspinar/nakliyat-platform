import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { TEST_CODE } from "./dogrulama";

// Site başlığı: telefonda menü düğmesi, rol bazında çağrı düğmesi, dar ekranda yana kayma yok.
const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
const PASSWORD = "baslik-sifre-1234";

const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

test("telefonda menü düğmesi bağlantıları açar, gezinince kapanır", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Menü düğmesi yalnızca dar ekranda");
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Menü" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  const menu = page.getByRole("navigation", { name: "Menü" });
  await expect(menu).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "Giriş yap" })).toBeVisible();
  await expectAccessible(page);

  // Esc ile kapanır
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  await toggle.click();
  await menu.getByRole("link", { name: "Firmalar için" }).click();
  await expect(page).toHaveURL(/\/firmalar-icin$/);
  await expect(menu).toBeHidden();
  await expect(page.getByRole("button", { name: "Menü" })).toHaveAttribute("aria-expanded", "false");
});

test("dar telefonda (320 px) başlık sayfayı yana kaydırmaz", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Telefon genişliği");
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/nasil-calisir");
  await expect(page.getByRole("banner").getByRole("link", { name: "Teklif al" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Menü" })).toBeInViewport();
  await expectNoHorizontalScroll(page);
});

test("firma hesabında başlık 'Teklif al' yerine paneli gösterir, sayfa yana kaymaz", async ({ page, request, isMobile }) => {
  const phone = `0534${uniqueDigits(7)}`;
  const reg = await request.post(`${API}/auth/register`, {
    data: { role: "COMPANY", fullName: "Başlık Firma", phone, password: PASSWORD, email: `baslik${phone}@test.local`, termsVersion: "2026-10-01" },
  });
  expect(reg.ok()).toBeTruthy();
  const headers = { Authorization: `Bearer ${(await reg.json()).accessToken}` };
  expect((await request.post(`${API}/auth/verification/email/confirm`, { headers, data: { code: TEST_CODE } })).ok()).toBeTruthy();

  await page.goto("/giris");
  await page.getByLabel("Cep telefonu").fill(phone);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/firma-paneli/);

  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Teklif al" })).toHaveCount(0);
  await expect(header.getByRole("link", { name: "Firma paneli" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  if (isMobile) {
    await page.getByRole("button", { name: "Menü" }).click();
    await expect(header.getByRole("button", { name: "Çıkış" })).toBeVisible();
  }
});
