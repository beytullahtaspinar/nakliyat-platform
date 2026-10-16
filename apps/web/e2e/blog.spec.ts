import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Blog: yönetici kategori, yazar ve yazıyı yönetim panelinden açar; yazı sitede /blog altında yayınlanır.
 * Gerçek API ve veritabanıyla çalışır. Her proje (mobil/masaüstü) kendi kısa adlarını kullanır.
 */
const PASSWORD = "yonetici-sifre-123";
const IMAGE = path.join(__dirname, "fixtures", "oda.jpg");

const uniqueDigits = (n: number) => `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-n);

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const summary = results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`));
  expect(summary, "Erişilebilirlik ihlalleri").toEqual([]);
}

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function jsonLdTypes(page: Page) {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.flatMap((text) => [JSON.parse(text)].flat().map((item: { "@type": string }) => item["@type"]));
}

async function loginAsAdmin(page: Page) {
  const phone = `0533${uniqueDigits(7)}`;
  execFileSync("node", ["dist/create-admin.js"], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ADMIN_PHONE: phone, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: "Blog Editörü" },
  });
  await page.goto("/giris");
  await page.getByLabel("Cep telefonu").fill(phone);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/yonetim$/);
}

const CONTENT = (extra = "") => `Taşınmaya en az dört hafta önce hazırlanmaya başlamalısın.

## Dört hafta önce

Nakliyat firmalarından [ücretsiz teklif al](/talep-olustur) ve tarihi kesinleştir. ${"Eşyalarını gözden geçir, kullanmadıklarını ayır. ".repeat(8)}

## İki hafta önce

- Kolileri topla
- Abonelikleri taşı

## Taşınma günü

| Ev tipi | Koli sayısı |
| --- | --- |
| 1+1 | 20-30 |
| 3+1 | 60-80 |

<script>alert("xss")</script>
<p onclick="alert(1)">Güvenli paragraf</p>
${extra}`;

test.describe.configure({ mode: "serial" });

test.describe("blog", () => {
  let suffix: string;
  let slug: string;
  let categorySlug: string;
  let authorSlug: string;
  let editUrl: string;
  const title = () => `Taşınma kontrol listesi ${suffix}: 4 haftalık plan`;

  test.beforeAll(() => {
    suffix = uniqueDigits(6);
    slug = `tasinma-kontrol-listesi-${suffix}-4-haftalik-plan`;
    categorySlug = `tasinma-rehberi-${suffix}`;
    authorSlug = `elif-yilmaz-${suffix}`;
  });

  test("yönetici kategori, yazar ve yazı açıp yayınlar", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAsAdmin(page);

    await page.getByRole("navigation", { name: "Yönetim" }).getByRole("link", { name: "Blog" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Blog" })).toBeVisible();

    // Kategori
    await page.getByRole("link", { name: "Kategoriler" }).click();
    const newCategory = page.locator("form").filter({ has: page.getByRole("button", { name: "Kategori ekle" }) });
    await newCategory.getByLabel("Ad", { exact: true }).fill(`Taşınma Rehberi ${suffix}`);
    await newCategory.getByLabel("Açıklama").fill("Taşınma öncesi ve sonrası yapılacaklar.");
    await newCategory.getByRole("button", { name: "Kategori ekle" }).click();
    await expect(newCategory.getByText("Kategori eklendi.")).toBeVisible();
    await expect(page.getByText(`/blog/kategori/${categorySlug}`)).toBeVisible();

    // Yazar (fotoğraflı)
    await page.goto("/yonetim/blog/yazarlar");
    const newAuthor = page.locator("form").filter({ has: page.getByRole("button", { name: "Yazar ekle" }) });
    await newAuthor.getByLabel("Ad soyad").fill(`Elif Yılmaz ${suffix}`);
    await newAuthor.getByLabel("Unvan").fill("Nakliyat sektörü editörü");
    await newAuthor.getByLabel("Kısa özgeçmiş").fill("10 yıldır evden eve nakliyat üzerine yazıyor.");
    await newAuthor.getByLabel("Profil bağlantıları").fill("https://www.linkedin.com/in/ornek");
    await newAuthor.getByLabel("Fotoğraf yükle").setInputFiles(IMAGE);
    await expect(newAuthor.getByRole("button", { name: "Fotoğrafı kaldır" })).toBeVisible();
    await newAuthor.getByRole("button", { name: "Yazar ekle" }).click();
    await expect(newAuthor.getByText("Yazar eklendi.")).toBeVisible();
    await expect(page.getByText(`Elif Yılmaz ${suffix}`)).toBeVisible();

    // Yazı
    await page.goto("/yonetim/blog/yeni");
    await page.getByLabel("Başlık").fill(title());
    // Adres başlıktan Türkçe karakterler dönüştürülerek üretilir
    await expect(page.getByLabel("Adres")).toHaveValue(slug);
    await page.getByLabel("Özet").fill("Taşınmadan önceki dört haftada yapılacakları adım adım anlatan kontrol listesi ve ipuçları.");
    await page.getByLabel("Kısaca (net cevap)").fill("En az dört hafta önce başla: teklif al, kolileri topla, abonelikleri taşı.");
    await page.getByLabel("İçerik", { exact: true }).fill(CONTENT());
    await page.getByRole("button", { name: "+ Soru ekle" }).click();
    await page.getByLabel("Soru 1").fill("Taşınmaya ne zaman hazırlanmalıyım?");
    await page.getByLabel("Cevap", { exact: true }).fill("En az dört hafta önce başlamanı öneririz.");
    await page.getByLabel("Kategori", { exact: true }).selectOption({ label: `Taşınma Rehberi ${suffix}` });
    await page.getByLabel("Yazar", { exact: true }).selectOption({ label: `Elif Yılmaz ${suffix}` });
    await page.getByLabel("Görsel yükle").setInputFiles(IMAGE);
    await page.getByLabel("Görsel açıklaması (alt metin)").fill("Taşınmaya hazır koliler");

    // Önizleme sitedeki dönüştürmeyle aynı: betik atılır
    await page.getByRole("tab", { name: "Önizle" }).click();
    await expect(page.getByRole("heading", { name: "Dört hafta önce" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Önizle" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Yaz" }).click();

    await expectAccessible(page);
    await page.getByRole("button", { name: "Yayınla" }).click();
    await expect(page).toHaveURL(/\/yonetim\/blog\/[a-z0-9]+\?kaydedildi=published$/);
    await expect(page.getByText("Yazı yayında; sitedeki sayfa güncellendi.")).toBeVisible();
    editUrl = page.url().replace(/\?.*$/, "");
    expect(errors).toEqual([]);
  });

  test("yazı sitede: Kısaca kutusu, içindekiler, SSS, yazar ve yapısal veri", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/blog");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Taşınma rehberi");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /^index/);
    await page.getByRole("link", { name: title() }).click();
    await expect(page).toHaveURL(new RegExp(`/blog/${slug}$`));

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title());
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page).toHaveTitle(new RegExp(`^${title()} \\|`));
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /dört haftada/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/blog/${slug}$`));

    await expect(page.getByRole("region", { name: "Kısaca" })).toContainText("En az dört hafta önce başla");
    const toc = page.getByRole("navigation", { name: "İçindekiler" });
    await toc.getByRole("link", { name: "İki hafta önce" }).click();
    await expect(page).toHaveURL(/#iki-hafta-once$/);
    await expect(page.getByRole("region", { name: "Sık sorulan sorular" })).toContainText("Taşınmaya ne zaman hazırlanmalıyım?");

    const article = page.locator("article");
    await expect(article.locator("script, iframe, [onclick], [style]")).toHaveCount(0);
    await expect(article.getByRole("link", { name: "ücretsiz teklif al" })).toHaveAttribute("href", "/talep-olustur");
    // Kapak görseli sitenin kendi adresinden yüklenir
    const cover = article.getByRole("img", { name: "Taşınmaya hazır koliler" });
    await expect(cover).toHaveAttribute("src", /^\/medya\/blog\/[a-f0-9]{32}\.(webp|jpg)$/);
    expect(await cover.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

    expect(await jsonLdTypes(page)).toEqual(expect.arrayContaining(["BlogPosting", "FAQPage", "BreadcrumbList"]));
    await expectAccessible(page);

    // Yazar sayfası
    await page.getByRole("complementary", { name: "Yazar hakkında" }).getByRole("link", { name: `Elif Yılmaz ${suffix}` }).click();
    await expect(page).toHaveURL(new RegExp(`/blog/yazar/${authorSlug}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Elif Yılmaz ${suffix}`);
    await expect(page.getByRole("link", { name: "LinkedIn" })).toHaveAttribute("href", "https://www.linkedin.com/in/ornek");
    await expect(page.getByRole("link", { name: title() })).toBeVisible();
    expect(await jsonLdTypes(page)).toEqual(expect.arrayContaining(["ProfilePage", "Blog"]));
    await expectAccessible(page);

    // Kategori sayfası
    await page.goto(`/blog/kategori/${categorySlug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Taşınma Rehberi ${suffix}`);
    await expect(page.getByRole("link", { name: title() })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("RSS, site haritası ve llms.txt yazıyı listeler; olmayan adresler 404", async ({ page, request }) => {
    expect(await (await request.get("/blog/rss.xml")).text()).toContain(`<title>${title()}</title>`);
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain(`/blog/${slug}</loc>`);
    expect(sitemap).toContain(`/blog/kategori/${categorySlug}</loc>`);
    expect(sitemap).toContain(`/blog/yazar/${authorSlug}</loc>`);
    const llms = await (await request.get("/llms.txt")).text();
    expect(llms).toContain("# evdenevenakliyat.app");
    expect(llms).toContain(`/blog/${slug}): Taşınmadan önceki dört haftada`);

    expect((await page.goto("/blog/boyle-bir-yazi-yok"))?.status()).toBe(404);
    expect((await page.goto("/blog/kategori/boyle-bir-kategori-yok"))?.status()).toBe(404);
    expect((await page.goto("/blog/yazar/boyle-bir-yazar-yok"))?.status()).toBe(404);
    expect((await page.goto("/blog/sayfa/9"))?.status()).toBe(404);
  });

  test("adres değişince eski adres yönlenir; taslağa alınan yazı sitede görünmez", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(editUrl);
    const newSlug = `${slug}-guncel`;
    await page.getByLabel("Adres").fill(newSlug);
    await page.getByRole("button", { name: "Güncelle" }).click();
    await expect(page.getByText("Yazı yayında; sitedeki sayfa güncellendi.")).toBeVisible();

    await page.goto(`/blog/${slug}`);
    await expect(page).toHaveURL(new RegExp(`/blog/${newSlug}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title());

    await page.goto(editUrl);
    await page.getByRole("button", { name: "Yayından kaldır (taslak)" }).click();
    await expect(page.getByText("Taslak kaydedildi; sitede görünmüyor.")).toBeVisible();
    expect((await page.goto(`/blog/${newSlug}`))?.status()).toBe(404);
  });
});
