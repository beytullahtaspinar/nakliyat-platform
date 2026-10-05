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

test("firma paneli kendi kabuğunda açılır, sayfa yana kaymaz", async ({ page, request }) => {
  const phone = `0534${uniqueDigits(7)}`;
  const reg = await request.post(`${API}/auth/register`, {
    data: { role: "COMPANY", fullName: "Başlık Firma", phone, password: PASSWORD, email: `baslik${phone}@test.local`, termsVersion: "2026-10-01" },
  });
  expect(reg.ok()).toBeTruthy();
  const headers = { Authorization: `Bearer ${(await reg.json()).accessToken}` };
  expect((await request.post(`${API}/auth/verification/email/confirm`, { headers, data: { code: TEST_CODE } })).ok()).toBeTruthy();
  const profile = await request.post(`${API}/company/profile`, {
    headers,
    data: { displayName: `Başlık Nakliyat ${phone.slice(-5)}`, legalName: "Başlık Nakliyat Ltd.", taxNumber: uniqueDigits(10).replace(/^0/, "1"), cityCode: "34", serviceCityCodes: ["34"] },
  });
  expect(profile.ok()).toBeTruthy();

  await page.goto("/giris");
  await page.getByLabel("Cep telefonu").fill(phone);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/firma-paneli/);

  // Firma paneli kendi kabuğunda (yönetim gibi): tanıtım sitesinin menüsü yok, çıkış her ekranda görünür
  await expect(page.getByRole("navigation", { name: "Ana menü" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Teklif al" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Firma paneli" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Gelen talepler" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Çıkış/ })).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Panelde ince altbilgi: yasal metinler var, tanıtım sütunları yok
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("navigation", { name: "Yasal metinler" })).toBeVisible();
  await expect(footer.getByRole("navigation", { name: "Taşınacaklar için" })).toHaveCount(0);

  // Telefonda seçili sekme (en sondaki Bildirimler) ekranda görünür
  await page.goto("/firma-paneli/bildirimler");
  const tab = page.getByRole("navigation", { name: "Firma paneli" }).getByRole("link", { name: "Bildirimler" });
  await expect(tab).toHaveAttribute("aria-current", "page");
  // -mb-px alt çizgisi kayan kutuda 1 px kırpılır
  await expect(tab).toBeInViewport({ ratio: 0.9 });
  await expectNoHorizontalScroll(page);
});

test("tanıtım sayfasında tam altbilgi, masaüstü menüde bulunduğun sayfa işaretli", async ({ page, isMobile }) => {
  await page.goto("/nasil-calisir");
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("navigation", { name: "Taşınacaklar için" })).toBeVisible();
  if (!isMobile) {
    const menu = page.getByRole("navigation", { name: "Ana menü" });
    await expect(menu.getByRole("link", { name: "Nasıl çalışır?" })).toHaveAttribute("aria-current", "page");
    await expect(menu.getByRole("link", { name: "Firmalar için" })).not.toHaveAttribute("aria-current", "page");
  }
});
