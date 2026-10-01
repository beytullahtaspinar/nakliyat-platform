import { expect, test } from "@playwright/test";

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

  const home = page.getByRole("group", { name: /Evin ve tarih/ });
  await home.getByRole("combobox", { name: "Ev tipi", exact: true }).selectOption({ label: "2+1" });
  const date = await home.getByLabel("Taşınma tarihi").getAttribute("min");
  await home.getByLabel("Taşınma tarihi").fill(date!);

  const account = page.getByRole("group", { name: /Teklifleri nereden takip edeceksin/ });
  await account.getByLabel("Ad soyad").fill("Deneme Müşteri");
  await account.getByLabel("Cep telefonu").fill(phone);
  await account.getByLabel("Şifre").fill("guvenli-sifre-123");
  await account.getByLabel(/Kişisel verilerimin/).check();

  await page.getByRole("button", { name: "Ücretsiz teklif iste" }).click();

  await expect(page).toHaveURL(/\/hesabim/);
  await expect(page.getByText(/Kadıköy/).first()).toBeVisible();
  await expect(page.getByText(/Çankaya/).first()).toBeVisible();

  // Bildirim ayarları: e-posta eklenir, bir bildirim kapatılır, kayıt kalıcıdır
  await page.getByRole("link", { name: "Bildirim ayarları" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bildirim ayarları");
  await page.getByLabel("Bildirim e-postası").fill(`musteri${phone}@test.local`);
  const accepted = page.getByRole("listitem").filter({ hasText: "Teklif kabulü" });
  await accepted.getByRole("checkbox").uncheck();
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("status")).toHaveText("Bildirim ayarların kaydedildi.");
  await page.reload();
  await expect(page.getByLabel("Bildirim e-postası")).toHaveValue(`musteri${phone}@test.local`);
  await expect(accepted.getByRole("checkbox")).not.toBeChecked();
  await expect(page.getByRole("listitem").filter({ hasText: "Talebime yeni teklif" }).getByRole("checkbox")).toBeChecked();
});
