import { expect, test } from "@playwright/test";

// Google / Apple girişi: testte sağlayıcı yerine sahte "test" girişi kullanılır (OAUTH_TEST_PROVIDER).
// Akış gerçeğiyle aynı: /api/giris/<sağlayıcı> → sağlayıcı → /api/giris/<sağlayıcı>/donus.
test("Google ile ilk girişte telefon sorulur, sonraki girişte doğrudan hesaba girilir", async ({ page, context }) => {
  const digits = `${Date.now()}`.slice(-7);
  const email = `sosyal${digits}@test.local`;

  await page.goto(`/api/giris/test?login_hint=${encodeURIComponent(email)}`);
  await expect(page).toHaveURL(/\/kayit\/tamamla/);
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByLabel("Ad soyad")).toHaveValue("Test Kullanıcı");
  await page.getByLabel("Cep telefonu").fill(`0538${digits}`);
  await page.getByLabel(/Kişisel verilerimin/).check();
  await page.getByRole("button", { name: "Kaydı tamamla" }).click();

  // E-postayı sağlayıcı doğruladı: doğrulama ekranı atlanır
  await expect(page).toHaveURL(/\/hesabim$/);
  await expect(page.getByText("hesabını doğrula", { exact: false })).toHaveCount(0);

  await context.clearCookies();
  await page.goto(`/api/giris/test?login_hint=${encodeURIComponent(email)}`);
  await expect(page).toHaveURL(/\/hesabim$/);
});

test("yarım kalan giriş hata mesajıyla giriş sayfasına döner", async ({ page }) => {
  await page.goto("/api/giris/test/donus?code=x&state=baska");
  await expect(page).toHaveURL(/\/giris\?hata=sure/);
  await expect(page.getByRole("alert").filter({ hasText: "Giriş süresi doldu" })).toBeVisible();
  // Adresteki serbest metin sayfaya yazılmaz
  await page.goto("/giris?hata=Hesabin%20kilitlendi");
  await expect(page.getByText("Hesabin kilitlendi")).toHaveCount(0);
});
