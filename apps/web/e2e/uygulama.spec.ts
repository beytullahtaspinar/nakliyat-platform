import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Telefona kurulum (manifest, servis işçisi) ve bu cihazda anlık bildirimi açma/kapama.
const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
const PASSWORD = "uygulama-sifre-123";
const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);

test("uygulama bildirimi ve simgeler sunulur", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  const body = await manifest.json();
  expect(body).toMatchObject({ short_name: "Nakliyat", start_url: "/uygulama", display: "standalone", lang: "tr" });
  for (const icon of body.icons) expect((await request.get(icon.src)).ok()).toBeTruthy();

  const sw = await request.get("/sw.js");
  expect(sw.ok()).toBeTruthy();
  expect(sw.headers()["cache-control"]).toContain("no-cache");
  expect((await request.get("/cevrimdisi.html")).ok()).toBeTruthy();
  expect((await request.get("/apple-icon.png")).ok()).toBeTruthy();

  // Oturum yoksa açılış adresi ana sayfaya gider
  const start = await request.get("/uygulama", { maxRedirects: 0 });
  expect(start.status()).toBe(307);
  expect(start.headers().location).toBe("/");
});

/** Tarayıcının push servisi yerine sahte abonelik: test push servisine bağlanmaz. */
async function fakePushService(page: Page) {
  await page.addInitScript(() => {
    let current: unknown = null;
    const make = (applicationServerKey: ArrayBuffer) => {
      const sub = {
        endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${Math.random().toString(36).slice(2)}`,
        options: { applicationServerKey, userVisibleOnly: true },
        toJSON() {
          return { endpoint: this.endpoint, keys: { p256dh: "BTest-p256dh", auth: "test-auth" } };
        },
        async unsubscribe() {
          current = null;
          return true;
        },
      };
      return sub;
    };
    PushManager.prototype.getSubscription = async () => current as PushSubscription | null;
    PushManager.prototype.subscribe = async (options?: PushSubscriptionOptionsInit) => {
      const key = options?.applicationServerKey as Uint8Array;
      current = make(key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer);
      return current as PushSubscription;
    };
  });
}

test("firma bu cihazda anlık bildirimi açıp kapatır", async ({ page, request, context, browserName }) => {
  test.skip(browserName !== "chromium");
  await context.grantPermissions(["notifications"]);
  await fakePushService(page);

  const phone = `0535${uniqueDigits(7)}`;
  const reg = await request.post(`${API}/auth/register`, {
    data: { role: "COMPANY", fullName: "Push Yetkilisi", phone, password: PASSWORD, termsVersion: "2026-10-01" },
  });
  expect(reg.ok()).toBeTruthy();
  const headers = { Authorization: `Bearer ${(await reg.json()).accessToken}` };
  const name = `Push Nakliyat ${uniqueDigits(5)}`;
  expect(
    (
      await request.post(`${API}/company/profile`, {
        headers,
        data: { displayName: name, legalName: `${name} Ltd.`, taxNumber: uniqueDigits(10).replace(/^0/, "1"), cityCode: "06", serviceCityCodes: ["06"] },
      })
    ).ok(),
  ).toBeTruthy();

  await page.goto("/giris");
  await page.getByLabel("Cep telefonu").fill(phone);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/giris"));
  await page.goto("/firma-paneli");

  // Panelde hatırlatma, oradan ayarlara
  await expect(page.getByText("Yeni talepleri anında gör.")).toBeVisible();
  await page.getByRole("link", { name: "Nasıl yapılır?" }).click();
  await expect(page.getByRole("heading", { name: "Uygulama ve anlık bildirimler" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Anlık bildirim" }).first()).toBeChecked();

  await page.getByRole("button", { name: "Bu cihazda bildirimleri aç" }).click();
  await expect(page.getByText("Bu cihazda bildirimler açıldı.")).toBeVisible();
  const prefs = async () => (await (await request.get(`${API}/notifications/preferences`, { headers })).json()).push.devices;
  expect(await prefs()).toBe(1);

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);

  await page.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(page.getByText("Bu cihazda bildirimler kapatıldı.")).toBeVisible();
  expect(await prefs()).toBe(0);

  // Yeniden aç, çıkış yapınca cihaz kaydı silinsin
  await page.getByRole("button", { name: "Bu cihazda bildirimleri aç" }).click();
  await expect(page.getByText("Bu cihazda bildirimler açıldı.")).toBeVisible();
  expect(await prefs()).toBe(1);
  await page.getByRole("button", { name: "Çıkış" }).click();
  await expect(page).toHaveURL("/");
  await expect.poll(prefs).toBe(0);
});
