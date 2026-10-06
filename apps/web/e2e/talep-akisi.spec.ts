import { expect, test } from "@playwright/test";
import { verifyEmail } from "./dogrulama";

// Kritik akış: yeni bir müşteri formu doldurur, hesabı aynı adımda açılır ve talebi panelinde görür.
test("müşteri talep oluşturur ve hesabında görür", async ({ page }) => {
  const phone = `0532${String(Date.now()).slice(-7)}`;

  await page.goto("/talep-olustur");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ücretsiz teklif al");

  const from = page.getByRole("group", { name: /Nereden taşınıyorsun/ });
  await from.getByRole("combobox", { name: "İl", exact: true }).selectOption({ label: "İstanbul" });
  await from.getByRole("combobox", { name: "İlçe", exact: true }).selectOption({ label: "Kadıköy" });
  await from.getByLabel("Açık adres").fill("Caferağa Mah. Moda Cad. No: 10 D: 3");
  await from.getByRole("combobox", { name: "Kat", exact: true }).selectOption({ label: "3. kat" });

  const to = page.getByRole("group", { name: /Nereye taşınıyorsun/ });
  await to.getByRole("combobox", { name: "İl", exact: true }).selectOption({ label: "Ankara" });
  await to.getByRole("combobox", { name: "İlçe", exact: true }).selectOption({ label: "Çankaya" });
  await to.getByLabel("Açık adres").fill("Kızılay Mah. Atatürk Bulvarı No: 20 D: 5");
  await to.getByRole("combobox", { name: "Kat", exact: true }).selectOption({ label: "Zemin / bahçe katı" });

  const home = page.getByRole("group", { name: /Ev tipi ve tarih/ });
  await home.getByRole("combobox", { name: "Ev tipi", exact: true }).selectOption({ label: "2+1" });
  const date = await home.getByLabel("Taşınma tarihi").getAttribute("min");
  await home.getByLabel("Taşınma tarihi").fill(date!);

  const account = page.getByRole("group", { name: /Teklifleri nereden takip edeceksin/ });
  await account.getByLabel("Ad soyad").fill("Deneme Müşteri");
  await account.getByLabel("Cep telefonu").fill(phone);
  await account.getByLabel("E-posta").fill(`musteri${phone}@test.local`);
  await account.getByLabel("Şifre").fill("guvenli-sifre-123");
  await account.getByLabel(/Kullanım koşullarını kabul ediyorum/).check();

  await page.getByRole("button", { name: "Ücretsiz teklif iste" }).click();

  // Hesap doğrulanana kadar talep taslak kalır; kod girilince yayına alınır
  await verifyEmail(page);
  await expect(page).toHaveURL(/\/hesabim\?yeni=/);
  await expect(page.getByText("Talebin alındı.", { exact: false })).toBeVisible();
  await expect(page.getByText("Teklif bekliyor")).toBeVisible();
  await expect(page.getByText(/Kadıköy/).first()).toBeVisible();
  await expect(page.getByText(/Çankaya/).first()).toBeVisible();

  // Bildirim ayarları: e-posta eklenir, bir bildirim kapatılır, kayıt kalıcıdır
  await page.getByRole("link", { name: "Bildirim ayarları" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bildirim ayarları");
  await page.getByLabel("Bildirim e-postası").fill(`musteri${phone}@test.local`);
  const accepted = page.getByRole("listitem").filter({ hasText: "Teklif kabulü" });
  await accepted.getByRole("checkbox", { name: "E-posta" }).uncheck();
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("status")).toHaveText("Bildirim ayarların kaydedildi.");
  await page.reload();
  await expect(page.getByLabel("Bildirim e-postası")).toHaveValue(`musteri${phone}@test.local`);
  await expect(accepted.getByRole("checkbox", { name: "E-posta" })).not.toBeChecked();
  await expect(accepted.getByRole("checkbox", { name: "Anlık bildirim" })).toBeChecked();
  await expect(page.getByRole("listitem").filter({ hasText: "Talebime yeni teklif" }).getByRole("checkbox", { name: "E-posta" })).toBeChecked();
});

// iPhone'da bildirilen: tarih kutusu sağa taşıyordu; eksik alanla "Teklif iste" sessiz kalıyordu
test("dar ekranda tarih kutusu taşmaz, eksik alan düğmenin yanında söylenir", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/talep-olustur");

  const box = await page.getByLabel("Taşınma tarihi").boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);

  await page.getByRole("button", { name: "Ücretsiz teklif iste" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "İl:" })).toBeVisible();
  await expect(page).toHaveURL(/\/talep-olustur/);
  await expect(page.getByRole("group", { name: /Nereden taşınıyorsun/ }).getByRole("combobox", { name: "İl", exact: true })).toBeInViewport();
});
