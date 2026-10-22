import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PDF_PATH, PHOTO_PATH, randomPlate } from "./belgeler";

// Firma aracını ruhsat ve önden/yandan/arkadan fotoğrafla ekler; yönetici reddeder, firma düzeltir, yönetici onaylar.
const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
const PASSWORD = "arac-sifre-1234";
const ROOM_PATH = path.join(__dirname, "fixtures", "oda.jpg");
const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);
const spaced = (plate: string) => plate.replace(/^(\d{2})([A-Z]+)(\d+)$/, "$1 $2 $3");

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function login(page: Page, phone: string) {
  await page.goto("/giris");
  await page.getByLabel("Cep telefonu").fill(phone);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
}

test("firma aracını ekler; yönetici ruhsatı ve fotoğrafları yan yana inceleyip karar verir", async ({ browser, page, request }) => {
  test.setTimeout(120_000);
  const adminPhone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: adminPhone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "Araç Yönetici" },
  });

  const phone = `0535${uniqueDigits(7)}`;
  const companyName = `Araç Nakliyat ${uniqueDigits(5)}`;
  const reg = await request.post(`${API}/auth/register`, {
    data: { role: "COMPANY", fullName: "Araç Yetkilisi", phone, password: PASSWORD },
  });
  expect(reg.ok()).toBeTruthy();
  const { accessToken } = await reg.json();
  const profile = await request.post(`${API}/company/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      displayName: companyName,
      legalName: `${companyName} Ltd. Şti.`,
      taxNumber: uniqueDigits(10).replace(/^0/, "1"),
      cityCode: "34",
      serviceCityCodes: ["34"],
    },
  });
  expect(profile.ok()).toBeTruthy();
  const plate = randomPlate();

  // Firma: Araçlar sayfası, doğrulama uyarısı Araçlar'a yönlendirir
  await login(page, phone);
  await expect(page).toHaveURL(/\/firma-paneli/);
  await expect(page.getByRole("status").filter({ hasText: "doğrulama bekliyor" }).getByRole("link", { name: "Araçlar" })).toBeVisible();
  await page.getByRole("navigation", { name: "Firma paneli" }).getByRole("link", { name: "Araçlar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Araçlar" })).toBeVisible();
  await expect(page.getByText("Henüz onaylı aracın yok.")).toBeVisible();

  const form = page.getByRole("form", { name: "Araç ekle" });
  await form.getByLabel("Plaka").fill(spaced(plate).toLowerCase());
  await form.getByLabel("Araç ruhsatı").setInputFiles(PDF_PATH);
  await form.getByLabel("Önden fotoğraf").setInputFiles(PHOTO_PATH);
  await form.getByLabel("Yandan fotoğraf").setInputFiles(PHOTO_PATH);
  // Yetki belgesi seçilmeden ve fotoğraf eksikken kaydedilmez
  await form.getByRole("button", { name: "Aracı ekle" }).click();
  await expect(form.getByRole("alert")).toContainText("K3 ya da L1");
  await form.getByLabel(/^K3 yetki belgesi/).check();
  await form.getByRole("button", { name: "Aracı ekle" }).click();
  await expect(form.getByRole("alert")).toContainText("arkadan fotoğraf");
  await form.getByLabel("Arkadan fotoğraf").setInputFiles(PHOTO_PATH);
  await expect(form.getByRole("img", { name: "Arkadan fotoğraf önizlemesi" })).toBeVisible();
  await form.getByRole("button", { name: "Aracı ekle" }).click();

  const card = page.getByRole("region", { name: `${spaced(plate)} plakalı araç` });
  await expect(card).toBeVisible();
  await expect(card.getByText("İnceleniyor")).toBeVisible();
  await expect(card.getByRole("img", { name: "Önden fotoğraf" })).toBeVisible();
  await expect(page.getByText("Aracın inceleniyor.")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);

  // Yönetici: Araçlar listesinde ruhsat ve üç fotoğraf yan yana, hazır gerekçeyle reddeder
  const adminContext = await browser.newContext({ ...test.info().project.use });
  const admin = await adminContext.newPage();
  await login(admin, adminPhone);
  await expect(admin).toHaveURL(/\/yonetim$/);
  await admin.getByRole("navigation", { name: "Yönetim" }).getByRole("link", { name: /^Araçlar/ }).click();
  await expect(admin.getByRole("heading", { level: 1, name: "Araçlar" })).toBeVisible();
  await admin.getByRole("search").getByRole("searchbox").fill(spaced(plate));
  await admin.getByRole("search").getByRole("button", { name: "Ara" }).click();
  const item = admin.getByRole("listitem").filter({ hasText: companyName });
  await expect(item.getByText(spaced(plate), { exact: true })).toBeVisible();
  await expect(item.getByRole("link", { name: /tam boyutta aç/ })).toHaveCount(4);
  await expectNoHorizontalScroll(admin);
  await expectAccessible(admin);
  await item.getByRole("button", { name: "Reddet" }).click();
  await item.getByRole("button", { name: /plaka okunmuyor/ }).click();
  await item.getByRole("button", { name: "Aracı reddet" }).click();
  await expect(item.getByText("Ret gerekçesi: Fotoğraflarda plaka okunmuyor", { exact: false })).toBeVisible();

  // Firma gerekçeyi görür, yalnızca arka fotoğrafı değiştirip yeniden gönderir
  await page.reload();
  await expect(card.getByText("Reddedildi")).toBeVisible();
  await expect(card.getByText(/Ret gerekçesi: Fotoğraflarda plaka okunmuyor/)).toBeVisible();
  await card.getByRole("button", { name: "Düzelt" }).click();
  const edit = card.getByRole("form", { name: "Aracı düzelt" });
  await edit.getByLabel("Arkadan fotoğraf").setInputFiles(ROOM_PATH);
  await edit.getByRole("button", { name: "Düzeltmeyi gönder" }).click();
  await expect(card.getByText("İnceleniyor")).toBeVisible();

  // Yönetici firma inceleme ekranında onaylar; firma da onaylanabilir hale gelir
  await admin.goto("/yonetim/araclar");
  await admin.getByRole("listitem").filter({ hasText: companyName }).getByRole("link", { name: companyName }).click();
  await expect(admin.getByRole("heading", { level: 1 })).toHaveText(companyName);
  await expect(admin.getByText(/Onay için önce şunlar onaylanmalı/)).toContainText("Onaylı araç");
  const vehicles = admin.getByRole("region", { name: "Araçlar" });
  await vehicles.getByRole("button", { name: "Onayla", exact: true }).click();
  await vehicles.getByRole("button", { name: "Evet, aynı; onayla" }).click();
  await expect(vehicles.getByText("Onaylandı", { exact: true })).toBeVisible();
  await expect(vehicles.getByRole("button", { name: "Onayla", exact: true })).toHaveCount(0);
  await admin.reload();
  await expect(admin.getByText(/Onay için önce şunlar onaylanmalı/)).not.toContainText("Onaylı araç");
  await expect(admin.getByText("Araç onaylandı", { exact: false }).first()).toBeVisible();
  await expectAccessible(admin);
  await adminContext.close();

  await page.reload();
  await expect(card.getByText("Onaylandı")).toBeVisible();
  await expect(card.getByRole("button", { name: "Düzelt" })).toHaveCount(0);
  await expect(page.getByText("1 onaylı aracın var.")).toBeVisible();
});
