import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Bölge sayfaları: yönetici il sayfasının başlığını, giriş metnini, kapak görselini, ek içeriğini ve SSS'sini
 * değiştirir; sayfa sitede hemen güncellenir, "Varsayılana dön" ile otomatik metne döner.
 * Her proje (mobil/masaüstü) kendi ilini kullanır. Kayıt bir süreçte yapılır, sayfa ikinci süreçte de yenilenmeli
 * (canlıda web birden çok Node süreciyle çalışır; cache-handler.cjs).
 */
const PASSWORD = "yonetici-sifre-123";
const IMAGE = path.join(__dirname, "fixtures", "oda.jpg");
/** playwright.config.ts SECOND_WEB_PORT ve INDEXNOW_MOCK_PORT */
const SECOND_WEB_PORT = 3001;
const INDEXNOW_MOCK = "http://127.0.0.1:4300";

type IndexNowRequest = { host: string; key: string; keyLocation: string; urlList: string[] };

/** Sahte IndexNow'a bu adresi içeren bildirim geldi mi */
async function indexNowReceived(request: APIRequestContext, url: string) {
  const res = await request.get(`${INDEXNOW_MOCK}/alinan`);
  const all = (await res.json()) as IndexNowRequest[];
  return all.find((r) => r.urlList.includes(url));
}

const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const summary = results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`));
  expect(summary, "Erişilebilirlik ihlalleri").toEqual([]);
}

async function loginAsAdmin(page: Page) {
  const phone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: phone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "Sayfa Editörü" },
  });
  await page.goto("/giris");
  await page.getByLabel("Cep telefonu").fill(phone);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/yonetim$/);
}

test("yönetici il sayfasının metnini ve görselini değiştirir, sonra varsayılana döner", async ({ page, browser }, testInfo) => {
  const city = testInfo.project.name === "mobil" ? { name: "Sinop", slug: "sinop" } : { name: "Yozgat", slug: "yozgat" };
  const url = `/${city.slug}-evden-eve-nakliyat`;
  page.on("dialog", (d) => d.accept());
  await loginAsAdmin(page);

  await page.goto(`/yonetim/sayfalar?ara=${city.name}`);
  await page.getByRole("link", { name: `${city.name} Evden Eve Nakliyat`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/yonetim/sayfalar/${city.slug}-evden-eve-nakliyat$`));
  // Boş alanlarda otomatik metin yer tutucu olarak görünür
  await expect(page.getByLabel("Sayfa başlığı (H1)")).toHaveAttribute("placeholder", `${city.name} Evden Eve Nakliyat`);
  await expectAccessible(page);

  // İkinci süreç sayfayı önbelleğine alsın
  const otherProcess = await browser.newContext({ baseURL: `http://127.0.0.1:${SECOND_WEB_PORT}` });
  const otherVisitor = await otherProcess.newPage();
  await otherVisitor.goto(url);
  await expect(otherVisitor.getByRole("heading", { level: 1 })).toHaveText(`${city.name} Evden Eve Nakliyat`);

  await page.getByLabel("Sayfa başlığı (H1)").fill(`${city.name} evden eve nakliyat rehberi`);
  await page.getByLabel("Giriş metni").fill(`${city.name} için yazılmış özel giriş.\n\nİkinci paragraf.`);
  await page.getByLabel("Ek içerik (isteğe bağlı)").fill(`## ${city.name}'da taşınırken\n\nDar sokaklarda küçük araç gerekir.`);
  await page.getByLabel("Görsel yükle").setInputFiles(IMAGE);
  await page.getByLabel("Görsel açıklaması (alt metin)").fill(`${city.name} taşıma görseli`);
  await page.getByRole("button", { name: "+ Soru ekle" }).click();
  await page.getByLabel("Soru 1").fill(`${city.name} içi taşınma kaç saat sürer?`);
  await page.getByLabel("Cevap").fill("Ortalama bir 2+1 ev 4-6 saatte taşınır.");
  await page.getByLabel("Google başlığı").fill(`${city.name} Nakliyat Rehberi`);
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Kaydedildi; sitedeki sayfa güncellendi.");

  // Kaydedilen sayfa Bing'e (IndexNow) bildirilir
  const pageUrl = `https://evdenevenakliyat.app${url}`;
  await expect.poll(async () => (await indexNowReceived(page.request, pageUrl))?.keyLocation).toBe(
    "https://evdenevenakliyat.app/indexnow.txt",
  );

  await page.goto("/yonetim/sayfalar?durum=duzenlenen");
  await expect(page.getByRole("link", { name: `${city.name} Evden Eve Nakliyat`, exact: true })).toBeVisible();

  // Site: oturumsuz ziyaretçi
  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  await visitor.goto(url);
  await expect(visitor).toHaveTitle(`${city.name} Nakliyat Rehberi | evdenevenakliyat.app`);
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(`${city.name} evden eve nakliyat rehberi`);
  await expect(visitor.getByText("İkinci paragraf.")).toBeVisible();
  await expect(visitor.getByRole("img", { name: `${city.name} taşıma görseli` })).toBeVisible();
  await expect(visitor.getByRole("heading", { name: `${city.name}'da taşınırken` })).toBeVisible();
  await expect(visitor.getByText(`${city.name} içi taşınma kaç saat sürer?`)).toBeVisible();
  // Fiyat tablosu otomatik kalır
  await expect(visitor.getByRole("row", { name: /2\+1 .* TL/ })).toBeVisible();
  await expectAccessible(visitor);

  // Kaydı karşılamayan süreç de yeni içeriği gösterir
  await otherVisitor.goto(url);
  await expect(otherVisitor.getByRole("heading", { level: 1 })).toHaveText(`${city.name} evden eve nakliyat rehberi`);
  await expect(otherVisitor.getByRole("img", { name: `${city.name} taşıma görseli` })).toBeVisible();

  // Varsayılana dön
  await page.goto(`/yonetim/sayfalar/${city.slug}-evden-eve-nakliyat`);
  await page.getByRole("button", { name: /Varsayılana dön/ }).click();
  await expect(page.getByRole("status")).toHaveText("Sayfa otomatik metne döndü.");
  await visitor.goto(url);
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(`${city.name} Evden Eve Nakliyat`);
  await expect(visitor.getByRole("img", { name: `${city.name} taşıma görseli` })).toHaveCount(0);
  await otherVisitor.goto(url);
  await expect(otherVisitor.getByRole("heading", { level: 1 })).toHaveText(`${city.name} Evden Eve Nakliyat`);
  await visitorContext.close();
  await otherProcess.close();
});

test("IndexNow anahtar dosyası yayında, yönetici tüm sayfaları bildirebilir", async ({ page, request }) => {
  const key = await request.get("/indexnow.txt");
  expect(key.status()).toBe(200);
  const keyText = (await key.text()).trim();
  expect(keyText).toMatch(/^[a-f0-9]{32}$/);

  await loginAsAdmin(page);
  await page.goto("/yonetim/sayfalar");
  await page.getByRole("button", { name: "Tüm sayfaları Bing'e bildir" }).click();
  await expect(page.getByRole("status")).toHaveText(/\d+ adres Bing ve Yandex'e bildirildi\./);
  const sent = await indexNowReceived(request, "https://evdenevenakliyat.app/istanbul-evden-eve-nakliyat");
  expect(sent?.key).toBe(keyText);
  expect(sent?.urlList).toContain("https://evdenevenakliyat.app/evden-eve-nakliyat");
});
