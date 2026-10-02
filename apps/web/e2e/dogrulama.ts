import { expect, type Page } from "@playwright/test";

/** playwright.config.ts API'ye VERIFICATION_TEST_CODE olarak verir; canlıda bu değişken yok sayılır */
export const TEST_CODE = "424242";

/** Kayıt veya talep sonrası açılan doğrulama ekranında e-posta kodunu girer. */
export async function verifyEmail(page: Page) {
  await expect(page).toHaveURL(/\/dogrulama/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hesabını doğrula");
  await expect(page.getByText(/adresine 6 haneli bir kod gönderdik/)).toBeVisible();
  // 6 hane girilince form kendiliğinden gönderilir
  await page.getByLabel("Doğrulama kodu").fill(TEST_CODE);
}
