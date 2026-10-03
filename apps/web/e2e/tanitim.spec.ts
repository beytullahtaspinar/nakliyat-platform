import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { uploadRequiredDocuments } from "./belgeler";
import { TEST_CODE } from "./dogrulama";

// Firma tanıtım sayfası: firma panelden logo, tanıtım yazısı, hizmetler ve fotoğraf ekler; sayfa yayına girer,
// yeterince dolu olunca arama motoruna açılır, il sayfasından bağlantı alır. Yönetici fotoğrafı kaldırabilir.
const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
const PASSWORD = "tanitim-sifre-1234";
const fixture = (name: string) => path.join(__dirname, "fixtures", name);
const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);

const DESCRIPTION =
  "2008 yılından beri Bartın ve çevresinde evden eve nakliyat yapıyoruz. Asansörlü araçlarımız, " +
  "deneyimli ve sigortalı ekibimizle eşyalarınızı özenle paketliyor, söküp kuruyor ve yeni evinize " +
  "zamanında taşıyoruz. Şehirler arası taşımalarda da düzenli seferlerimiz var. Taşınma öncesinde ücretsiz " +
  "keşif yapıyor, hassas eşyalar için özel koruma malzemesi kullanıyoruz.";

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function verifiedCompany(request: APIRequestContext, phone: string, name: string) {
  const reg = await request.post(`${API}/auth/register`, {
    data: { role: "COMPANY", fullName: "Firma Yetkilisi", phone, password: PASSWORD, email: `tanitim${phone}@test.local`, termsVersion: "2026-10-01" },
  });
  expect(reg.ok()).toBeTruthy();
  const { accessToken } = await reg.json();
  const headers = { Authorization: `Bearer ${accessToken}` };
  expect((await request.post(`${API}/auth/verification/email/confirm`, { headers, data: { code: TEST_CODE } })).ok()).toBeTruthy();
  const profile = await request.post(`${API}/company/profile`, {
    headers,
    data: { displayName: name, legalName: `${name} Ltd.`, taxNumber: uniqueDigits(10).replace(/^0/, "1"), cityCode: "74", serviceCityCodes: ["74", "67"] },
  });
  expect(profile.ok()).toBeTruthy();
  await uploadRequiredDocuments(request, accessToken);
  return (await profile.json()).id as string;
}

async function login(page: Page, phone: string) {
  await page.goto("/giris");
  await page.getByLabel("Cep telefonu").fill(phone);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
}

test("firma tanıtım sayfasını doldurur; sayfa yayında, dizine açık ve il sayfasından bağlantılı", async ({ page, request, browser }) => {
  test.setTimeout(120_000);
  const adminPhone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: adminPhone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "Tanıtım Yönetici" },
  });
  const admin = await request.post(`${API}/auth/login`, { data: { phone: adminPhone, password: PASSWORD } });
  const adminHeaders = { Authorization: `Bearer ${(await admin.json()).accessToken}` };

  const companyPhone = `0534${uniqueDigits(7)}`;
  const companyName = `Tanıtım Nakliyat ${uniqueDigits(5)}`;
  const companyId = await verifiedCompany(request, companyPhone, companyName);
  const docs = await (await request.get(`${API}/admin/companies/${companyId}`, { headers: adminHeaders })).json();
  for (const doc of docs.documents) {
    expect((await request.post(`${API}/admin/companies/${companyId}/documents/${doc.id}/approve`, { headers: adminHeaders })).ok()).toBeTruthy();
  }
  expect((await request.post(`${API}/admin/companies/${companyId}/verify`, { headers: adminHeaders })).ok()).toBeTruthy();

  // Firma paneli → Tanıtım sayfası
  await login(page, companyPhone);
  await expect(page).toHaveURL(/\/firma-paneli$/);
  await page.getByRole("link", { name: "Tanıtım sayfası" }).click();
  await expect(page).toHaveURL(/\/firma-paneli\/tanitim$/);
  await expect(page.getByText("Sayfanın Google'da listelenmesi için")).toBeVisible();

  const logo = page.getByRole("region", { name: "Logo" });
  await logo.getByLabel("Logo yükle").setInputFiles(fixture("esya.jpg"));
  await expect(logo.getByRole("img", { name: "Firma logosu" })).toBeVisible({ timeout: 20_000 });

  const info = page.getByRole("region", { name: "Tanıtım bilgileri" });
  // İletişim bilgisi yazılamaz
  await info.getByLabel("Tanıtım yazısı").fill(`${DESCRIPTION} Bizi arayın: 0532 123 45 67`);
  await info.getByRole("button", { name: "Kaydet" }).click();
  await expect(info.getByRole("alert")).toContainText("telefon içeremez");
  await info.getByLabel("Tanıtım yazısı").fill(DESCRIPTION);
  await info.getByLabel("Evden eve nakliyat").check();
  await info.getByLabel("Asansörlü (dış cephe) taşıma").check();
  await info.getByLabel("Kuruluş yılı").fill("2008");
  await info.getByLabel("Araç sayısı").fill("6");
  await info.getByLabel("Ekip (kişi)").fill("14");
  await info.getByRole("button", { name: "Kaydet" }).click();
  await expect(info.getByText("Kaydedildi, sayfanda yayında.")).toBeVisible();

  const photos = page.getByRole("region", { name: "Fotoğraflar" });
  await photos.getByLabel("Fotoğraf ekle").setInputFiles([fixture("esya.jpg"), fixture("oda.jpg")]);
  await expect(photos.getByRole("listitem")).toHaveCount(2, { timeout: 30_000 });
  await photos.getByLabel("Fotoğraf açıklaması").first().fill("Asansörlü aracımız");
  await photos.getByRole("button", { name: "Kaydet" }).first().click();
  await expect(photos.getByText("Kaydedildi.")).toBeVisible();
  await expect(page.getByText("Sayfan Google'da listelenebilir.")).toBeVisible();
  await expectAccessible(page);

  // Herkese açık sayfa
  await page.getByRole("link", { name: "Sayfanı gör" }).click();
  await expect(page.getByRole("heading", { level: 1, name: companyName })).toBeVisible();
  const logoImg = page.getByRole("img", { name: `${companyName} logosu` });
  await expect(logoImg).toBeVisible();
  const logoSrc = await logoImg.getAttribute("src");
  expect(logoSrc).toMatch(/^\/medya\/firmalar\/[a-z0-9]+\/[a-f0-9]{32}\.(webp|jpg)$/);
  const logoFile = await request.get(logoSrc!.replace(/^/, "http://127.0.0.1:3000"));
  expect(logoFile.status()).toBe(200);
  expect(logoFile.headers()["cache-control"]).toContain("immutable");

  await expect(page.getByRole("heading", { name: `${companyName} hakkında` })).toBeVisible();
  await expect(page.getByText("2008 yılından beri Bartın")).toBeVisible();
  await expect(page.getByText("Asansörlü (dış cephe) taşıma")).toBeVisible();
  await expect(page.getByText("14 kişi")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /^index/);
  const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
  const company = jsonLd.map((t) => JSON.parse(t)).find((d) => d["@type"] === "MovingCompany");
  expect(company).toMatchObject({ foundingDate: "2008", numberOfEmployees: { value: 14 } });
  expect(company.image).toHaveLength(3);
  expect(company.hasOfferCatalog.itemListElement).toHaveLength(2);

  const gallery = page.getByRole("img", { name: "Asansörlü aracımız" });
  await gallery.scrollIntoViewIfNeeded();
  await gallery.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Kapat" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expectAccessible(page);

  // İl sayfası bölgede hizmet veren firmaya bağlantı verir (hizmet ili Zonguldak da)
  await page.goto("/zonguldak-evden-eve-nakliyat");
  await expect(page.getByRole("heading", { name: "Zonguldak ilinde hizmet veren doğrulanmış firmalar" })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(companyName) })).toBeVisible();

  // Yönetici bir fotoğrafı kaldırır: sayfada tek fotoğraf kalır, sayfa dizinden çıkar
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, adminPhone);
  await expect(adminPage).toHaveURL(/\/yonetim$/);
  await adminPage.goto(`/yonetim/firmalar/${companyId}`);
  await adminPage.getByRole("button", { name: "Sayfadan kaldır" }).nth(1).click();
  await adminPage.getByLabel("Gizleme gerekçesi").fill("Başka firmanın aracı");
  await adminPage.getByRole("button", { name: "Gizle", exact: true }).click();
  await expect(adminPage.getByText("Gizli: Başka firmanın aracı")).toBeVisible();
  await adminContext.close();

  await page.goto(`/firmalar/${companyName.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/\s+/g, "-")}-${companyId}`);
  await expect(page.getByRole("heading", { name: "Fotoğraflar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fotoğraflar" }).locator("..").getByRole("listitem")).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
