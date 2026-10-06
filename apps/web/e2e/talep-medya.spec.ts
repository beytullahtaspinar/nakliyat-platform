import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { verifyEmail } from "./dogrulama";

const fixture = (name: string) => path.join(__dirname, "fixtures", name);

async function fillRequestForm(page: Page, phone: string) {
  await page.goto("/talep-olustur");
  const from = page.getByRole("group", { name: /Nereden taşınıyorsun/ });
  await from.getByRole("combobox", { name: "İl", exact: true }).selectOption({ label: "İstanbul" });
  await from.getByRole("combobox", { name: "İlçe", exact: true }).selectOption({ label: "Kadıköy" });
  await from.getByLabel("Açık adres").fill("Caferağa Mah. Moda Cad. No: 10 D: 3");
  await from.getByRole("combobox", { name: "Kat", exact: true }).selectOption({ label: "3. kat" });
  const to = page.getByRole("group", { name: /Nereye taşınıyorsun/ });
  await to.getByRole("combobox", { name: "İl", exact: true }).selectOption({ label: "İstanbul" });
  await to.getByRole("combobox", { name: "İlçe", exact: true }).selectOption({ label: "Beşiktaş" });
  await to.getByLabel("Açık adres").fill("Sinanpaşa Mah. No: 20 D: 5");
  await to.getByRole("combobox", { name: "Kat", exact: true }).selectOption({ label: "Zemin / bahçe katı" });
  const home = page.getByRole("group", { name: /Ev tipi ve tarih/ });
  await home.getByRole("combobox", { name: "Ev tipi", exact: true }).selectOption({ label: "2+1" });
  const date = await home.getByLabel("Taşınma tarihi").getAttribute("min");
  await home.getByLabel("Taşınma tarihi").fill(date!);
  const account = page.getByRole("group", { name: /Teklifleri nereden takip edeceksin/ });
  await account.getByLabel("Ad soyad").fill("Fotoğraflı Müşteri");
  await account.getByLabel("Cep telefonu").fill(phone);
  await account.getByLabel("E-posta").fill(`medya${phone}@test.local`);
  await account.getByLabel("Şifre").fill("guvenli-sifre-123");
  await account.getByLabel(/Kullanım koşullarını kabul ediyorum/).check();
}

// Fotoğraf tarayıcıda küçültülür (en uzun kenar 1600 px), talep oluşunca yüklenir ve talep sayfasında görünür.
test("müşteri talebe fotoğraf ekler, sonradan silebilir", async ({ page }) => {
  const phone = `0533${String(Date.now()).slice(-7)}`;
  await fillRequestForm(page, phone);

  await page.getByLabel("Fotoğraf veya video seç").setInputFiles(fixture("esya.jpg"));
  await expect(page.getByText(/Yüklenecek: \d+ KB/)).toBeVisible();
  await page.getByRole("button", { name: "Ücretsiz teklif iste" }).click();
  await verifyEmail(page);
  await expect(page).toHaveURL(/\/hesabim\?yeni=/);

  await page.getByRole("link", { name: /Kadıköy/ }).first().click();
  const gallery = page.getByRole("img", { name: "Eşya fotoğrafı 1" });
  await expect(gallery).toBeVisible();
  // Görsel gerçekten yüklendi ve küçültüldü (geç yüklenen görsel: önce ekrana getir)
  await gallery.scrollIntoViewIfNeeded();
  const size = await gallery.evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    return { w: img.naturalWidth, h: img.naturalHeight };
  });
  expect(size).toEqual({ w: 1600, h: 1200 });

  // İkinci fotoğraf talep sayfasından eklenir; ikisi slider'da gezilir
  await page.getByLabel("Fotoğraf veya video seç").setInputFiles(fixture("oda.jpg"));
  await page.getByRole("button", { name: "Talebe ekle" }).click();
  const slider = page.getByRole("region", { name: "Eşya fotoğrafları ve videoları" });
  await expect(slider.getByText("1 / 2")).toBeVisible();
  await slider.getByRole("button", { name: "Sonraki" }).click();
  await expect(slider.getByText("2 / 2")).toBeVisible();
  await expect(page.getByRole("img", { name: "Eşya fotoğrafı 2" })).toBeInViewport();
  await page.getByRole("button", { name: "1. dosyayı göster" }).click();
  await expect(slider.getByText("1 / 2")).toBeVisible();
  await expect(gallery).toBeInViewport();

  // Sil, görünen dosyayı siler
  for (const remaining of [1, 0]) {
    await page.getByRole("button", { name: "Sil", exact: true }).click();
    await page.getByRole("button", { name: "Sil", exact: true }).click();
    await expect(page.getByRole("img", { name: /Eşya fotoğrafı/ })).toHaveCount(remaining);
  }
});

// Test videosu WebM: testlerdeki açık kaynak Chromium H.264 çözemiyor (Chrome ve Safari çözer).
test("video tarayıcıda 720p'ye küçültülüp eklenir", async ({ page }) => {
  await page.goto("/");
  const canEncode = await page.evaluate(async () => {
    if (typeof VideoEncoder === "undefined") return false;
    for (const codec of ["avc1.42001f", "vp09.00.10.08", "vp8"]) {
      const { supported } = await VideoEncoder.isConfigSupported({ codec, width: 1280, height: 720 });
      if (supported) return true;
    }
    return false;
  });
  test.skip(!canEncode, "Bu tarayıcıda video kodlayıcı yok");

  const phone = `0534${String(Date.now()).slice(-7)}`;
  await fillRequestForm(page, phone);
  await page.getByLabel("Fotoğraf veya video seç").setInputFiles(fixture("oda.webm"));
  await expect(page.getByText(/Yüklenecek:/)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Ücretsiz teklif iste" }).click();
  await verifyEmail(page);
  await expect(page).toHaveURL(/\/hesabim\?yeni=/);
  await page.getByRole("link", { name: /Kadıköy/ }).first().click();
  await expect(page.getByText(/^Video · 0:02$/)).toBeVisible();
});
