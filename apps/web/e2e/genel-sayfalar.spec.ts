import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Sayfada WCAG 2.2 AA erişilebilirlik ihlali olmamalı */
async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const summary = results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")} – ${n.failureSummary?.split("\n").at(-1)?.trim()}`));
  expect(summary, "Erişilebilirlik ihlalleri").toEqual([]);
}

/** Tarayıcı konsolunda hata olmamalı (PageSpeed "En İyi Uygulamalar" da bunu ölçer) */
function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test("ana sayfa açılır, teklif almaya yönlendirir", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /teklif al/i }).first()).toBeVisible();
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test("il sayfası açılır ve yapısal veri içerir", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/istanbul-evden-eve-nakliyat");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("İstanbul");
  await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached();
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test("olmayan sayfa 404 ve yönlendirici içerik döner", async ({ page }) => {
  const res = await page.goto("/boyle-bir-sayfa-yok");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Aradığın sayfa bulunamadı" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ücretsiz teklif al" }).last()).toBeVisible();
  await expectAccessible(page);
});

test("giriş ve kayıt sayfaları erişilebilir", async ({ page }) => {
  for (const path of ["/giris", "/kayit", "/talep-olustur"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectAccessible(page);
  }
});

test("yasal metinler açılır, altbilgiden ulaşılır ve erişilebilir", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/");
  const legal = page.getByRole("navigation", { name: "Yasal metinler", exact: true });
  for (const [name, heading] of [
    ["Kullanım koşulları", "Kullanım Koşulları"],
    ["KVKK aydınlatma metni", "KVKK Aydınlatma Metni"],
    ["Gizlilik politikası", "Gizlilik Politikası"],
    ["Çerez politikası", "Çerez Politikası"],
    ["Açık rıza metni", "Açık Rıza Metni"],
  ]) {
    await legal.getByRole("link", { name, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await expectAccessible(page);
  }
  expect(errors).toEqual([]);
});

test("kayıt formu koşulların kabulünü ister, ileti izni isteğe bağlıdır", async ({ page }) => {
  await page.goto("/kayit");
  await expect(page.getByLabel(/Kullanım koşullarını kabul ediyorum/)).toHaveAttribute("required", "");
  await expect(page.getByLabel(/Kampanya ve duyurulardan/)).not.toHaveAttribute("required", "");
  await expect(page.getByRole("link", { name: "KVKK aydınlatma metnini" })).toHaveAttribute("target", "_blank");
});

test("sağlık adresi çalışır", async ({ request }) => {
  const res = await request.get("/api/saglik");
  expect(res.ok()).toBe(true);
  expect(await res.json()).toMatchObject({ status: "ok" });
});
