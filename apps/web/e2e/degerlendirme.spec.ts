import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { uploadRequiredDocuments } from "./belgeler";
import { moveDayIsToday } from "./db";
import { TEST_CODE } from "./dogrulama";

// Taşınma tamamlanınca müşteri firmayı puanlar, firma yanıtlar, yorum firma sayfasında görünür,
// yönetici gizleyince sayfadan kalkar. Hazırlık API'den, akış tarayıcıdan.
const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
const PASSWORD = "yorum-sifre-1234";

const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function verifiedUser(request: APIRequestContext, role: "CUSTOMER" | "COMPANY", fullName: string, phone: string) {
  const reg = await request.post(`${API}/auth/register`, {
    data: { role, fullName, phone, password: PASSWORD, email: `yorum${phone}@test.local`, termsVersion: "2026-10-01" },
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

test("tamamlanan taşımada müşteri firmayı değerlendirir, yorum firma sayfasında yayımlanır", async ({ page, request, browser }) => {
  // Üç ayrı oturum (müşteri, firma, yönetici) ve birkaç erişilebilirlik taraması: varsayılan 30 sn dar kalır
  test.setTimeout(90_000);
  // Doğrulanmış firma
  const adminPhone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: adminPhone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "Yorum Yönetici" },
  });
  const admin = await request.post(`${API}/auth/login`, { data: { phone: adminPhone, password: PASSWORD } });
  const adminHeaders = { Authorization: `Bearer ${(await admin.json()).accessToken}` };

  const companyPhone = `0534${uniqueDigits(7)}`;
  const companyName = `Yorum Nakliyat ${uniqueDigits(5)}`;
  const company = await verifiedUser(request, "COMPANY", "Firma Yetkilisi", companyPhone);
  const profile = await request.post(`${API}/company/profile`, {
    headers: company,
    data: { displayName: companyName, legalName: `${companyName} Ltd.`, taxNumber: uniqueDigits(10).replace(/^0/, "1"), cityCode: "35", serviceCityCodes: ["35", "06"] },
  });
  const companyId = (await profile.json()).id;
  await uploadRequiredDocuments(request, company.Authorization.slice(7));
  const docs = await (await request.get(`${API}/admin/companies/${companyId}`, { headers: adminHeaders })).json();
  for (const doc of docs.documents) {
    expect((await request.post(`${API}/admin/companies/${companyId}/documents/${doc.id}/approve`, { headers: adminHeaders })).ok()).toBeTruthy();
  }
  expect((await request.post(`${API}/admin/companies/${companyId}/verify`, { headers: adminHeaders })).ok()).toBeTruthy();

  // Müşteri talep açar, firma teklif verir, müşteri kabul eder; taşınma günü gelir
  const customerPhone = `0532${uniqueDigits(7)}`;
  const customer = await verifiedUser(request, "CUSTOMER", "Ayşe Puanlayan", customerPhone);
  const moveDate = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const created = await request.post(`${API}/requests`, {
    headers: customer,
    data: {
      fromCityCode: "35", fromDistrict: "karsiyaka", fromAddress: "Yorum Sok. No:1", fromFloor: 1, fromHasElevator: false,
      toCityCode: "06", toDistrict: "cankaya", toAddress: "Puan Sok. No:2", toFloor: 2, toHasElevator: true,
      homeType: "TWO_PLUS_ONE", moveDate,
    },
  });
  const requestId = (await created.json()).id;
  const quote = await request.post(`${API}/company/requests/${requestId}/quotes`, {
    headers: company,
    data: { priceTry: 21000, crewSize: 3, vehicleType: "KAMYON" },
  });
  expect(quote.ok()).toBeTruthy();
  const accepted = await request.post(`${API}/quotes/${(await quote.json()).id}/accept`, { headers: customer });
  expect(accepted.ok()).toBeTruthy();
  moveDayIsToday((await accepted.json()).booking.id);

  // Müşteri taşınmanın bittiğini onaylar ve firmayı değerlendirir
  await login(page, customerPhone);
  await expect(page).toHaveURL(/\/hesabim$/);
  await page.goto(`/hesabim/talepler/${requestId}`);
  await page.getByRole("button", { name: "Taşınma tamamlandı" }).click();
  await page.getByRole("button", { name: "Evet, tamamlandı" }).click();
  await expect(page.getByRole("heading", { name: "Taşıman tamamlandı" })).toBeVisible();
  const section = page.locator("#degerlendirme");
  await expect(section.getByRole("heading", { name: `${companyName} firmasını değerlendir` })).toBeVisible();
  await expectAccessible(page);

  await section.getByRole("radio", { name: "4 yıldız, İyi" }).check({ force: true });
  await expect(section.getByRole("radio", { name: "4 yıldız, İyi" })).toBeChecked();
  await section.getByLabel(`${companyName} ile deneyimin (isteğe bağlı)`).fill("Ekip çok özenliydi, yalnızca biraz geç geldiler.");
  await section.getByRole("button", { name: "Değerlendirmeyi gönder" }).click();
  await expect(section.getByRole("heading", { name: "Değerlendirmen" })).toBeVisible();
  await expect(section.getByText("Ekip çok özenliydi, yalnızca biraz geç geldiler.")).toBeVisible();
  await expect(section.getByRole("img", { name: "5 üzerinden 4,0 puan" })).toBeVisible();

  // Firma yorumu panelinde görür ve yanıtlar
  const companyContext = await browser.newContext();
  const companyPage = await companyContext.newPage();
  await login(companyPage, companyPhone);
  await expect(companyPage).toHaveURL(/\/firma-paneli$/);
  await companyPage.getByRole("navigation", { name: "Firma paneli" }).getByRole("link", { name: "Değerlendirmeler" }).click();
  await expect(companyPage.getByText("Ekip çok özenliydi, yalnızca biraz geç geldiler.")).toBeVisible();
  await expect(companyPage.getByText("1 değerlendirme")).toBeVisible();
  await companyPage.getByRole("button", { name: "Yanıtla" }).click();
  await companyPage.getByLabel("Yanıtın").fill("Gecikme için özür dileriz, yeni evinizde mutluluklar.");
  await companyPage.getByRole("button", { name: "Yanıtı yayımla" }).click();
  await expect(companyPage.getByText(`${companyName} yanıtı`)).toBeVisible();
  await expect(companyPage.getByText("Gecikme için özür dileriz, yeni evinizde mutluluklar.")).toBeVisible();
  await expect(companyPage.getByRole("button", { name: "Yanıtla" })).toHaveCount(0);
  await expectAccessible(companyPage);
  await companyContext.close();

  // Herkese açık firma sayfası: puan, kısaltılmış ad, firma yanıtı ve yapısal veri
  await page.reload();
  await section.getByRole("link", { name: "firma sayfasında" }).click();
  await expect(page).toHaveURL(/\/firmalar\/yorum-nakliyat-\d+-[a-z0-9]+#yorumlar$/);
  await expect(page.getByRole("heading", { level: 1, name: companyName })).toBeVisible();
  const reviews = page.locator("#yorumlar");
  await expect(reviews.getByText("Ayşe P. · İzmir → Ankara")).toBeVisible();
  await expect(reviews.getByText("Gecikme için özür dileriz, yeni evinizde mutluluklar.")).toBeVisible();
  await expect(page.getByText("Puanlayan")).toHaveCount(0);
  const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
  const business = jsonLd.map((t) => JSON.parse(t)).find((d) => d["@type"] === "MovingCompany");
  expect(business.aggregateRating).toMatchObject({ ratingValue: 4, reviewCount: 1, bestRating: 5 });
  expect(business.review[0]).toMatchObject({ author: { name: "Ayşe P." }, reviewRating: { ratingValue: 4 } });
  await expectAccessible(page);
  const companyUrl = page.url().split("#")[0];

  // Yönetici yorumu gerekçeyle gizler; firma sayfasından kalkar
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, adminPhone);
  await expect(adminPage).toHaveURL(/\/yonetim$/);
  await adminPage.goto(`/yonetim/degerlendirmeler?ara=${encodeURIComponent(companyName)}`);
  await adminPage.getByRole("button", { name: "Gizle" }).click();
  await adminPage.getByLabel("Gizleme gerekçesi").fill("Test için gizlendi.");
  await adminPage.getByRole("button", { name: "Yorumu gizle" }).click();
  await expect(adminPage.getByText("Gizleme gerekçesi: Test için gizlendi.")).toBeVisible();
  await expectAccessible(adminPage);
  await adminContext.close();

  await page.goto(companyUrl);
  await expect(page.locator("#yorumlar").getByText("Henüz değerlendirme yok.")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
