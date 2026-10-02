import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { nextYear, PDF_PATH } from "./belgeler";

// Firma doğrulama belgelerini panelden yükler; zorunlu belgeler incelemeye düşer.
const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
const PASSWORD = "firma-sifre-123";
const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);

test("firma zorunlu belgelerini yükler", async ({ page, request }) => {
  const phone = `0535${uniqueDigits(7)}`;
  const reg = await request.post(`${API}/auth/register`, {
    data: { role: "COMPANY", fullName: "Belge Yetkilisi", phone, password: PASSWORD },
  });
  expect(reg.ok()).toBeTruthy();
  const { accessToken } = await reg.json();
  const profile = await request.post(`${API}/company/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      displayName: `Belge Nakliyat ${uniqueDigits(5)}`,
      legalName: "Belge Nakliyat Ltd. Şti.",
      taxNumber: uniqueDigits(10).replace(/^0/, "1"),
      cityCode: "34",
      serviceCityCodes: ["34"],
    },
  });
  expect(profile.ok()).toBeTruthy();

  await page.goto("/giris");
  await page.getByLabel("Cep telefonu").fill(phone);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/firma-paneli/);

  await page.getByRole("navigation", { name: "Firma paneli" }).getByRole("link", { name: "Belgeler" }).click();
  await expect(page.getByRole("heading", { name: "Doğrulama belgeleri" })).toBeVisible();
  await expect(page.getByText("0/3 zorunlu belge onaylandı.")).toBeVisible();

  const section = (name: string) => page.getByRole("region", { name, exact: true });

  const k3 = section("K3 yetki belgesi");
  await k3.getByLabel(/^Dosya/).setInputFiles(PDF_PATH);
  // Tarih girilmeden yüklenmez
  await k3.getByRole("button", { name: "Yükle" }).click();
  await expect(k3.getByRole("alert")).toHaveText("Belgenin geçerlilik bitiş tarihini gir.");
  await k3.getByLabel("Geçerlilik bitişi").fill(nextYear());
  await k3.getByRole("button", { name: "Yükle" }).click();
  await expect(k3.getByRole("link", { name: "belge.pdf" })).toBeVisible();
  await expect(k3.getByText("İnceleniyor").first()).toBeVisible();

  for (const name of ["Vergi levhası", "Ticaret sicil gazetesi / faaliyet belgesi"]) {
    const s = section(name);
    await s.getByLabel(/^Dosya/).setInputFiles(PDF_PATH);
    await s.getByRole("button", { name: "Yükle" }).click();
    await expect(s.getByRole("link", { name: "belge.pdf" })).toBeVisible();
  }

  // Yüklenen belge açılır (imzalı adres)
  const href = await k3.getByRole("link", { name: "belge.pdf" }).getAttribute("href");
  const file = await request.get(href!);
  expect(file.headers()["content-type"]).toBe("application/pdf");

  const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(a11y.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});
