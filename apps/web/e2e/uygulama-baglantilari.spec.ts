import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { TEST_CODE } from "./dogrulama";

// Mağaza bağlantıları: müşteri uygulaması (ana sayfa, altbilgi, hesabım, kayıt), firma uygulaması
// (ana sayfa, firmalar için, firma paneli, firma kaydı); yapısal veri ve iPhone Safari şeridi
const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
const PASSWORD = "uygulama-sifre-123";
const PLAY = {
  musteri: "https://play.google.com/store/apps/details?id=app.evdenevenakliyat.musteri",
  firma: "https://play.google.com/store/apps/details?id=app.evdenevenakliyat.firma",
};
const APPLE = {
  musteri: "https://apps.apple.com/tr/app/evden-eve-nakliyat-app/id6821929870",
  firma: "https://apps.apple.com/tr/app/evden-eve-nakliyat-firma/id6821928977",
};
/** Ekran görüntüsü klasörü verilirse sayfalar kaydedilir (PR'daki görseller için) */
const SHOTS = process.env.SHOT_DIR;

const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function expectBadges(scope: ReturnType<Page["locator"]>, app: "musteri" | "firma") {
  await expect(scope.locator(`a[href="${PLAY[app]}"]`).first()).toBeVisible();
  await expect(scope.locator(`a[href="${APPLE[app]}"]`).first()).toBeVisible();
  // Rozet görselleri yüklenmiş olmalı (kırık görsel yok)
  for (const img of await scope.locator(`a[href="${PLAY[app]}"] img, a[href="${APPLE[app]}"] img`).all()) {
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
}

async function shot(page: Page, name: string, projectName: string, target?: ReturnType<Page["locator"]>) {
  if (!SHOTS) return;
  const file = `${SHOTS}/${name}-${projectName === "mobil" ? "mobil" : "masaustu"}.png`;
  if (target) {
    await target.scrollIntoViewIfNeeded();
    await target.screenshot({ path: file });
  } else await page.screenshot({ path: file });
}

async function verifiedUser(request: APIRequestContext, role: "CUSTOMER" | "COMPANY", phone: string) {
  const reg = await request.post(`${API}/auth/register`, {
    data: { role, fullName: "Uygulama Denemesi", phone, password: PASSWORD, email: `uyg${phone}@test.local`, termsVersion: "2026-10-01" },
  });
  expect(reg.ok()).toBeTruthy();
  const headers = { Authorization: `Bearer ${(await reg.json()).accessToken}` };
  expect((await request.post(`${API}/auth/verification/email/confirm`, { headers, data: { code: TEST_CODE } })).ok()).toBeTruthy();
  return headers;
}

async function login(page: Page, phone: string) {
  await page.goto("/giris");
  await page.getByLabel("Cep telefonu").fill(phone);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
}

test("ana sayfa ve altbilgi iki uygulamanın mağaza bağlantılarını, yapısal veriyi ve Safari şeridini verir", async ({ page }, testInfo) => {
  await page.goto("/");
  const section = page.locator("#mobil-uygulama");
  await expect(section.getByRole("heading", { name: "Taşınmanı cebinden takip et" })).toBeVisible();
  await expectBadges(section, "musteri");
  await expectBadges(section, "firma");
  await expect(section.locator("a[target=_blank]").first()).toHaveAttribute("rel", /noopener/);
  await shot(page, "1-ana-sayfa", testInfo.project.name, section);

  const footer = page.getByRole("contentinfo");
  await expectBadges(footer, "musteri");
  await expect(footer.getByRole("link", { name: "Google Play", exact: true })).toHaveAttribute("href", PLAY.firma);
  await expect(footer.getByRole("link", { name: "App Store", exact: true })).toHaveAttribute("href", APPLE.firma);
  await shot(page, "2-altbilgi", testInfo.project.name, footer);

  await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute("content", /app-id=6821929870/);
  const apps = await page.locator('script[type="application/ld+json"]').evaluateAll((els) =>
    els.flatMap((el) => [JSON.parse(el.textContent ?? "null")].flat()).filter((d) => d?.["@type"] === "MobileApplication"),
  );
  expect(apps.map((a) => a.installUrl).sort()).toEqual([PLAY.firma, PLAY.musteri]);
  expect(apps.every((a) => a.offers?.price === "0" && a.downloadUrl.length === 2)).toBe(true);
  // Telefonda sayfa yana kaymaz
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expectAccessible(page);
});

test("firmalar için sayfası ve firma kaydı firma uygulamasını gösterir", async ({ page }, testInfo) => {
  await page.goto("/firmalar-icin");
  const section = page.locator("#firma-uygulamasi");
  await expectBadges(section, "firma");
  await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute("content", /app-id=6821928977/);
  await shot(page, "3-firmalar-icin", testInfo.project.name, section);
  await expectAccessible(page);

  await page.goto("/kayit?rol=firma");
  await expectBadges(page.getByRole("main"), "firma");
  await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute("content", /app-id=6821928977/);
  await shot(page, "4-firma-kaydi", testInfo.project.name);

  await page.goto("/kayit");
  await expectBadges(page.getByRole("main"), "musteri");
  await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute("content", /app-id=6821929870/);
});

test("hesabım ve firma paneli kendi uygulamasının indirme kartını gösterir", async ({ page, browser, request }, testInfo) => {
  const customerPhone = `0532${uniqueDigits(7)}`;
  await verifiedUser(request, "CUSTOMER", customerPhone);
  await login(page, customerPhone);
  await expect(page).toHaveURL(/\/hesabim$/);
  const card = page.getByRole("region", { name: "Taleplerini telefondan takip et" });
  await expectBadges(card, "musteri");
  await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute("content", /app-id=6821929870/);
  await shot(page, "5-hesabim", testInfo.project.name);
  await expectAccessible(page);

  const companyPhone = `0534${uniqueDigits(7)}`;
  const company = await verifiedUser(request, "COMPANY", companyPhone);
  const profile = await request.post(`${API}/company/profile`, {
    headers: company,
    data: { displayName: `Uygulama Nakliyat ${uniqueDigits(5)}`, legalName: "Uygulama Nakliyat Ltd.", taxNumber: uniqueDigits(10).replace(/^0/, "1"), cityCode: "34", serviceCityCodes: ["34"] },
  });
  expect(profile.ok()).toBeTruthy();
  const context = await browser.newContext({ ...testInfo.project.use });
  const companyPage = await context.newPage();
  await login(companyPage, companyPhone);
  await expect(companyPage).toHaveURL(/\/firma-paneli/);
  const companyCard = companyPage.getByRole("region", { name: "Firma uygulamasını indir" });
  await expectBadges(companyCard, "firma");
  await expect(companyPage.locator('meta[name="apple-itunes-app"]')).toHaveAttribute("content", /app-id=6821928977/);
  await shot(companyPage, "6-firma-paneli", testInfo.project.name, companyCard);
  await expectAccessible(companyPage);
  await context.close();
});
