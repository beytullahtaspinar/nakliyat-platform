import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { uploadRequiredDocuments } from "./belgeler";
import { TEST_CODE } from "./dogrulama";

// Firma paneli CRM düzeni: pano, süzgeçli tablolar, işlemler menüsü, iş ayrıntısı ve müşteriler.
// Hazırlık API'den, akış tarayıcıdan.
const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
const PASSWORD = "crm-sifre-1234";

const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function verifiedUser(request: APIRequestContext, role: "CUSTOMER" | "COMPANY", fullName: string, phone: string) {
  const reg = await request.post(`${API}/auth/register`, {
    data: { role, fullName, phone, password: PASSWORD, email: `crm${phone}@test.local`, termsVersion: "2026-10-01" },
  });
  expect(reg.ok()).toBeTruthy();
  const headers = { Authorization: `Bearer ${(await reg.json()).accessToken}` };
  expect((await request.post(`${API}/auth/verification/email/confirm`, { headers, data: { code: TEST_CODE } })).ok()).toBeTruthy();
  return headers;
}

test("firma paneli CRM düzeninde: pano, süzgeçli talepler, işler ve müşteriler", async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const adminPhone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: adminPhone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "CRM Yönetici" },
  });
  const admin = await request.post(`${API}/auth/login`, { data: { phone: adminPhone, password: PASSWORD } });
  const adminHeaders = { Authorization: `Bearer ${(await admin.json()).accessToken}` };

  // Her proje (mobil/masaüstü) kendi ilinde: paralel çalışan testlerin talepleri karışmasın
  const area =
    testInfo.project.name === "mobil"
      ? { code: "75", name: "Ardahan", booked: "posof", bookedName: "Posof", open: "gole", openName: "Göle" }
      : { code: "79", name: "Kilis", booked: "musabeyli", bookedName: "Musabeyli", open: "elbeyli", openName: "Elbeyli" };
  const companyPhone = `0534${uniqueDigits(7)}`;
  const companyName = `CRM Nakliyat ${uniqueDigits(5)}`;
  const company = await verifiedUser(request, "COMPANY", "Firma Yetkilisi", companyPhone);
  const profile = await request.post(`${API}/company/profile`, {
    headers: company,
    data: { displayName: companyName, legalName: `${companyName} Ltd.`, taxNumber: uniqueDigits(10).replace(/^0/, "1"), cityCode: area.code, serviceCityCodes: [area.code] },
  });
  const companyId = (await profile.json()).id;
  await uploadRequiredDocuments(request, company.Authorization.slice(7));
  const docs = await (await request.get(`${API}/admin/companies/${companyId}`, { headers: adminHeaders })).json();
  for (const doc of docs.documents) {
    expect((await request.post(`${API}/admin/companies/${companyId}/documents/${doc.id}/approve`, { headers: adminHeaders })).ok()).toBeTruthy();
  }
  expect((await request.post(`${API}/admin/companies/${companyId}/verify`, { headers: adminHeaders })).ok()).toBeTruthy();

  const suffix = uniqueDigits(4);
  const customerName = `Selin Müşteri ${suffix}`;
  const customerPhone = `0532${uniqueDigits(7)}`;
  const customer = await verifiedUser(request, "CUSTOMER", customerName, customerPhone);
  const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const open = async (toDistrict: string, moveDate: string, extra: Record<string, unknown> = {}) => {
    const created = await request.post(`${API}/requests`, {
      headers: customer,
      data: {
        fromCityCode: area.code, fromDistrict: "merkez", fromAddress: "CRM Sok. No:1", fromFloor: 1, fromHasElevator: false,
        toCityCode: area.code, toDistrict, toAddress: "CRM Sok. No:2", toFloor: 2, toHasElevator: true,
        homeType: "TWO_PLUS_ONE", moveDate, ...extra,
      },
    });
    expect(created.ok()).toBeTruthy();
    return (await created.json()).id as string;
  };
  const booked = await open(area.booked, day(5));
  await open(area.open, day(2), {
    fromFloor: 4, needsPacking: true, specialItems: ["Piyano"], notes: "Piyano dikkatli taşınmalı.",
  });
  const quote = await request.post(`${API}/company/requests/${booked}/quotes`, {
    headers: company,
    data: { priceTry: 14500, crewSize: 3, vehicleType: "KAMYON" },
  });
  expect((await request.post(`${API}/quotes/${(await quote.json()).id}/accept`, { headers: customer })).ok()).toBeTruthy();

  await page.goto("/giris");
  await page.getByLabel("Cep telefonu").fill(companyPhone);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/firma-paneli$/);

  // Pano: sayılar ve yaklaşan iş
  await expect(page.getByRole("heading", { level: 1, name: "Pano" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^\d+ Teklif bekleyen talep/ })).toBeVisible();
  const upcoming = page.getByRole("table", { name: /Yaklaşan işler/ });
  await expect(upcoming.getByText(customerName)).toBeVisible();
  await expectAccessible(page);

  // Gelen talepler: teklif durumuna göre süzülür
  const nav = page.getByRole("navigation", { name: "Firma paneli" });
  await nav.getByRole("link", { name: /^Gelen talepler/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Gelen talepler" })).toBeVisible();
  await page.getByRole("link", { name: "Teklif vermediklerim" }).click();
  await expect(page).toHaveURL(/durum=yeni/);
  const requests = page.getByRole("table", { name: "Gelen talepler" });
  // Yeniden denemede önceki açık talepler de listelenebilir
  await expect(requests.getByRole("link", { name: new RegExp(`${area.name}, ${area.openName}$`) }).first()).toBeVisible();
  await expect(requests.getByRole("link", { name: new RegExp(`${area.name}, ${area.bookedName}$`) })).toHaveCount(0);
  await expectAccessible(page);

  // Talep ayrıntısı: fiyatı etkileyenler listede ve ayrıntıda göze batar
  const openRow = requests.getByRole("row").filter({ hasText: area.openName }).first();
  const flags = openRow.getByRole("list", { name: "Dikkat" });
  await expect(flags.getByText(/^!?Acil: /)).toBeVisible();
  await expect(flags.getByText("Çıkış: asansörsüz 4. kat")).toBeVisible();
  await expect(flags.getByText("Özel eşya: Piyano")).toBeVisible();
  await expect(flags.getByText("Paketleme")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("gelen-talepler.png"), fullPage: true });
  await openRow.getByRole("link", { name: "Teklif ver" }).click();
  const attention = page.getByRole("region", { name: /Fiyatı etkileyenler/ });
  await expect(attention.getByText("Çıkış: asansörsüz 4. kat")).toBeVisible();
  await expect(attention.getByText("Piyano")).toBeVisible();
  await expect(page.getByRole("region", { name: "Müşteri notu" }).getByText("Piyano dikkatli taşınmalı.")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Paketleme \(müşteri istiyor\)/ })).toBeChecked();
  await page.screenshot({ path: testInfo.outputPath("talep-ayrintisi.png"), fullPage: true });
  await expectAccessible(page);
  await page.goBack();

  // Tekliflerim: kabul edilenler
  await nav.getByRole("link", { name: "Tekliflerim" }).click();
  await page.getByRole("link", { name: "Kabul edilen" }).click();
  await expect(page.getByRole("table", { name: "Tekliflerim" }).getByText("₺14.500")).toBeVisible();

  // İşlerim: müşteri araması, işlemler menüsü ve iş ayrıntısı
  await nav.getByRole("link", { name: /^İşlerim/ }).click();
  await page.getByRole("searchbox").fill(customerName);
  await page.getByRole("button", { name: "Ara" }).click();
  await expect(page).toHaveURL(/ara=/);
  const jobs = page.getByRole("table", { name: "İşlerim" });
  await expect(jobs.getByRole("row")).toHaveCount(2);
  await expectAccessible(page);
  await jobs.getByRole("button", { name: /^İşlemler/ }).click();
  await expect(jobs.getByRole("link", { name: "Yol tarifi al" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(jobs.getByRole("link", { name: "Yol tarifi al" })).toHaveCount(0);
  await jobs.getByRole("button", { name: /^İşlemler/ }).click();
  await jobs.getByRole("link", { name: "Ayrıntılar ve mesajlar" }).click();
  await expect(page).toHaveURL(/\/firma-paneli\/isler\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { level: 1, name: new RegExp(customerName) })).toBeVisible();
  const info = page.getByRole("region", { name: "İş bilgileri" });
  await expect(info.getByText("₺14.500")).toBeVisible();
  await expect(page.getByRole("region", { name: "Adresler" }).getByText("CRM Sok. No:2")).toBeVisible();
  await expect(page.getByRole("button", { name: "İşi iptal et" })).toBeVisible();
  await expectAccessible(page);

  // Firma profili: telefon görünür ama firma değiştiremez
  await nav.getByRole("link", { name: "Firma profili" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Firma profili" })).toBeVisible();
  const prettyPhone = companyPhone.replace(/^(\d{4})(\d{3})(\d{2})(\d{2})$/, "$1 $2 $3 $4");
  await expect(page.getByText(prettyPhone)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Telefon" })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("firma-profili.png"), fullPage: true });
  await expectAccessible(page);

  // Müşteriler
  await nav.getByRole("link", { name: "Müşteriler" }).click();
  const customers = page.getByRole("table", { name: "Müşteriler" });
  await expect(customers.getByRole("link", { name: customerName })).toBeVisible();
  await expect(customers.getByText("₺14.500")).toBeVisible();
  await expectAccessible(page);
});
