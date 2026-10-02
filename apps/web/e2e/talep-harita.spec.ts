import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { verifyEmail } from "./dogrulama";

/**
 * Harita servisleri dış adreslerde; testte sahteleriyle değiştirilir:
 * boş bir harita stili ve iki adres sonucu dönen bir arama servisi.
 */
async function fakeMapServices(page: Page) {
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.fulfill({
      json: { version: 8, sources: {}, layers: [{ id: "zemin", type: "background", paint: { "background-color": "#e8efe9" } }] },
    }),
  );
  const feature = (lng: number, lat: number, name: string, district: string) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: { name, district, city: "İstanbul" },
  });
  await page.route("https://photon.komoot.io/**", (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get("q") ?? "";
    const features = url.pathname.startsWith("/reverse")
      ? [feature(29.0254, 40.9862, "Moda Caddesi", "Caferağa")]
      : q.includes("Sinanpaşa")
        ? [feature(29.0083, 41.0422, "Sinanpaşa Mahallesi", "Beşiktaş"), feature(29.01, 41.04, "Sinanpaşa Sokak", "Beşiktaş")]
        : [feature(29.0254, 40.9862, "Moda Caddesi", "Caferağa")];
    return route.fulfill({ json: { type: "FeatureCollection", features } });
  });
}

test("müşteri adresini haritada işaretler; işaret talep sayfasında görünür", async ({ page }) => {
  const phone = `0534${String(Date.now()).slice(-7)}`;
  await fakeMapServices(page);
  await page.goto("/talep-olustur");

  const from = page.getByRole("group", { name: /Nereden taşınıyorsun/ });
  await from.getByRole("combobox", { name: "İl", exact: true }).selectOption({ label: "İstanbul" });
  await from.getByRole("combobox", { name: "İlçe", exact: true }).selectOption({ label: "Kadıköy" });
  await from.getByLabel("Açık adres").fill("Caferağa Mah. Moda Cad. No: 10 D: 3");
  await from.getByRole("combobox", { name: "Kat", exact: true }).selectOption({ label: "3. kat" });
  // Yazılan adres aranır ve iğne oraya konur
  await from.getByRole("button", { name: /Haritada işaretle/ }).click();
  await expect(from.getByText("Yazdığın adrese göre işaretlendi", { exact: false })).toBeVisible();
  await expect(from.getByText("İşaretlenen yer: Moda Caddesi, Caferağa, İstanbul")).toBeVisible();

  const to = page.getByRole("group", { name: /Nereye taşınıyorsun/ });
  await to.getByRole("combobox", { name: "İl", exact: true }).selectOption({ label: "İstanbul" });
  await to.getByRole("combobox", { name: "İlçe", exact: true }).selectOption({ label: "Beşiktaş" });
  await to.getByLabel("Açık adres").fill("Sinanpaşa Mah. No: 20 D: 5");
  await to.getByRole("combobox", { name: "Kat", exact: true }).selectOption({ label: "Zemin / bahçe katı" });
  // Aramadan sonuç seçmek de iğneyi koyar
  await to.getByRole("button", { name: /Haritada işaretle/ }).click();
  await expect(to.getByText(/İşaretlenen yer: Sinanpaşa Mahallesi/)).toBeVisible();
  await to.getByRole("searchbox", { name: "Haritada adres ara" }).fill("Sinanpaşa Sokak");
  await to.getByRole("searchbox", { name: "Haritada adres ara" }).press("Enter");
  await to.getByRole("button", { name: "Sinanpaşa Sokak, Beşiktaş, İstanbul" }).click();
  await expect(to.getByText("İşaretlenen yer: Sinanpaşa Sokak, Beşiktaş, İstanbul")).toBeVisible();

  const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(a11y.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);

  const home = page.getByRole("group", { name: /Evin ve tarih/ });
  await home.getByRole("combobox", { name: "Ev tipi", exact: true }).selectOption({ label: "2+1" });
  const date = await home.getByLabel("Taşınma tarihi").getAttribute("min");
  await home.getByLabel("Taşınma tarihi").fill(date!);
  const account = page.getByRole("group", { name: /Teklifleri nereden takip edeceksin/ });
  await account.getByLabel("Ad soyad").fill("Haritalı Müşteri");
  await account.getByLabel("Cep telefonu").fill(phone);
  await account.getByLabel("E-posta").fill(`harita${phone}@test.local`);
  await account.getByLabel("Şifre").fill("guvenli-sifre-123");
  await account.getByLabel(/Kullanım koşullarını kabul ediyorum/).check();
  await page.getByRole("button", { name: "Ücretsiz teklif iste" }).click();

  await verifyEmail(page);
  await expect(page).toHaveURL(/\/hesabim\?yeni=/);
  await page.getByRole("link", { name: /Kadıköy/ }).first().click();
  await page.getByRole("button", { name: "Haritada göster" }).click();
  await expect(page.getByRole("img", { name: "Çıkış ve varış noktaları haritası" })).toBeVisible();
});
