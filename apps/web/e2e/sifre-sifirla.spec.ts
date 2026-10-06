import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { TEST_CODE } from "./dogrulama";

// Giriş ekranındaki "Şifremi unuttum" bağlantısından e-postaya gelen kodla yeni şifre belirlenir.
test("şifresini unutan kullanıcı e-postadaki kodla yeni şifre belirler", async ({ page, browser }) => {
  const phone = `0538${String(Date.now()).slice(-7)}`;
  const email = `sifre${phone}@test.local`;
  // Hesabı ayrı bir tarayıcı oturumunda aç (bu sayfa oturumsuz kalsın)
  const other = await browser.newPage();
  await other.goto("/kayit");
  await other.getByLabel("Ad soyad").fill("Şifre Unutan");
  await other.getByLabel("Cep telefonu").fill(phone);
  await other.getByLabel("E-posta").fill(email);
  await other.getByLabel("Şifre").fill("eski-sifre-123");
  await other.getByLabel(/Kullanım koşullarını kabul ediyorum/).check();
  await other.getByRole("button", { name: "Kayıt ol" }).click();
  await expect(other).toHaveURL(/\/dogrulama/);
  await other.close();

  await page.goto("/giris");
  await page.getByRole("link", { name: "Şifremi unuttum" }).click();
  await expect(page).toHaveURL(/\/sifre-sifirla$/);
  await page.getByLabel("E-posta").fill(email.toUpperCase());
  await page.getByRole("button", { name: "Kod gönder" }).click();

  await expect(page.getByText(/bir hesaba kayıtlıysa şifre sıfırlama kodunu gönderdik/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Yeni kod \(\d+ sn\)/ })).toBeDisabled();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);

  await page.getByLabel("E-postadaki kod").fill(TEST_CODE);
  await page.getByLabel("Yeni şifre (en az 8 karakter)").fill("yeni-sifre-123");
  await page.getByLabel("Yeni şifre (tekrar)").fill("baska-sifre-123");
  await page.getByRole("button", { name: "Şifremi değiştir" }).click();
  await expect(page.getByText("Şifreler aynı değil.")).toBeVisible();

  await page.getByLabel("Yeni şifre (tekrar)").fill("yeni-sifre-123");
  await page.getByRole("button", { name: "Şifremi değiştir" }).click();
  await expect(page).toHaveURL(/\/giris\?sifre=yenilendi$/);
  await expect(page.getByText("Şifren değişti. Yeni şifrenle giriş yap.")).toBeVisible();

  await page.getByLabel("Cep telefonu").fill(phone);
  await page.getByLabel("Şifre").fill("yeni-sifre-123");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/hesabim|\/dogrulama/);
});
