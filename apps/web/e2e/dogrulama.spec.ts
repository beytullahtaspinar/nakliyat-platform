import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { TEST_CODE } from "./dogrulama";

// TEST_CODE "000000" değil, aşağıdaki hatalı kod denemesi buna dayanır

// Kayıttan sonra e-posta doğrulama ekranı açılır; hatalı kod uyarı verir, doğru kod hesaba götürür.
test("yeni kullanıcı e-posta kodunu girer ve hesabına geçer", async ({ page }) => {
  const phone = `0535${String(Date.now()).slice(-7)}`;
  await page.goto("/kayit");
  await page.getByLabel("Ad soyad").fill("Kod Deneme");
  await page.getByLabel("Cep telefonu").fill(phone);
  await page.getByLabel("E-posta").fill(`kod${phone}@test.local`);
  await page.getByLabel("Şifre").fill("guvenli-sifre-123");
  await page.getByLabel(/Kullanım koşullarını kabul ediyorum/).check();
  await page.getByRole("button", { name: "Kayıt ol" }).click();

  await expect(page).toHaveURL(/\/dogrulama\?next=%2Fhesabim/);
  await expect(page.getByText(`kod${phone}@test.local`)).toBeVisible();
  await expect(page.getByRole("button", { name: /Yeni kod \(\d+ sn\)/ })).toBeDisabled();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);

  const wrong = "000000";
  await page.getByLabel("Doğrulama kodu").fill(wrong);
  await expect(page.getByText("Kod hatalı. 4 deneme hakkın kaldı.")).toBeVisible();

  // E-postadan boşluklu kopyalanan kod da tam yapışır ("424 242")
  await page.getByLabel("Doğrulama kodu").fill(`${TEST_CODE.slice(0, 3)} ${TEST_CODE.slice(3)}`);
  await expect(page).toHaveURL(/\/hesabim$/);
  await expect(page.getByText("hesabını doğrula", { exact: false })).toHaveCount(0);
});

// E-postada bağlantı yok; kopyalanan kod "Kodu yapıştır" düğmesiyle tek dokunuşla girilir
test("kopyalanan kod yapıştır düğmesiyle girilir", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const phone = `0537${String(Date.now()).slice(-7)}`;
  await page.goto("/kayit");
  await page.getByLabel("Ad soyad").fill("Yapıştır Deneme");
  await page.getByLabel("Cep telefonu").fill(phone);
  await page.getByLabel("E-posta").fill(`yapistir${phone}@test.local`);
  await page.getByLabel("Şifre").fill("guvenli-sifre-123");
  await page.getByLabel(/Kullanım koşullarını kabul ediyorum/).check();
  await page.getByRole("button", { name: "Kayıt ol" }).click();
  await expect(page).toHaveURL(/\/dogrulama/);

  // Panoda kod dışında yazı olsa da hane hane alınır
  await page.evaluate((code) => navigator.clipboard.writeText(`Doğrulama kodun: ${code}`), TEST_CODE);
  await page.getByRole("button", { name: "Kodu yapıştır" }).click();
  await expect(page).toHaveURL(/\/hesabim$/);
});
