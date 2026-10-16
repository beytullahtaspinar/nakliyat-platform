/**
 * PageSpeed (Lighthouse) ölçümü için sahte blog API'si: yalnızca blog uçları (/v1/blog/*, /v1/public-media/blog/*).
 * Diğer her istek 503 döner (API kapalıymış gibi; sayfalar API'siz hâllerini gösterir).
 * Tarayıcı testleri (blog.spec.ts) gerçek API ile çalışır; bu dosya yalnızca lighthouse.yml içindir.
 *
 * Çalıştırma: node e2e/blog-api-mock.mjs (varsayılan port 4000, BLOG_MOCK_PORT ile değişir)
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.BLOG_MOCK_PORT ?? 4000);
const IMAGE = readFileSync(new URL("./fixtures/oda.jpg", import.meta.url));
const FILE = "0123456789abcdef0123456789abcdef.jpg";
const THUMB = "fedcba9876543210fedcba9876543210.jpg";

const image = {
  src: `/medya/blog/${FILE}`,
  width: 1200,
  height: 1600,
  thumb: { src: `/medya/blog/${THUMB}`, width: 1200, height: 1600 },
  alt: "Taşınmaya hazır koliler",
};
const category = { slug: "tasinma-rehberi", name: "Taşınma Rehberi", description: "Taşınma öncesi ve sonrası yapılacaklar.", postCount: 3 };
const author = {
  slug: "elif-yilmaz",
  name: "Elif Yılmaz",
  jobTitle: "Nakliyat sektörü editörü",
  bio: "10 yıldır evden eve nakliyat ve lojistik üzerine yazıyor.",
  photo: null,
  sameAs: ["https://www.linkedin.com/in/ornek"],
};

const content = `Taşınma kontrol listesi, taşınmadan önceki haftaları planlamanı sağlar. Kısa cevap: **en az dört hafta önce** başlamalısın.

## Dört hafta önce

Nakliyat firmalarından [ücretsiz teklif al](/talep-olustur) ve tarihi kesinleştir. ${"Eşyalarını gözden geçir, kullanmadıklarını ayır. ".repeat(6)}

## İki hafta önce

- Kolileri topla
- Abonelikleri taşı
- Adres değişikliğini e-Devlet'ten bildir

## Taşınma günü

| Ev tipi | Koli sayısı |
| --- | --- |
| 1+1 | 20-30 |
| 3+1 | 60-80 |

> Değerli eşyalarını yanında taşı.
`;

function summary(slug, title, day) {
  return {
    id: `mock-${slug}`,
    slug,
    title,
    excerpt: `${title} hakkında bilmen gerekenler: adım adım hazırlık, maliyetler ve dikkat edilecek noktalar.`,
    publishedAt: `2026-09-${String(day).padStart(2, "0")}T09:00:00.000Z`,
    updatedAt: `2026-09-${String(day).padStart(2, "0")}T09:00:00.000Z`,
    cover: image,
    category: { slug: category.slug, name: category.name },
    authorSlug: author.slug,
    authorName: author.name,
  };
}

const posts = [
  summary("tasinma-kontrol-listesi", "Taşınma kontrol listesi: 4 haftalık plan", 20),
  summary("koli-nasil-hazirlanir", "Koli nasıl hazırlanır? Kırılacak eşya paketleme", 15),
  summary("abonelik-nakli", "Taşınırken abonelik nakli nasıl yapılır?", 10),
];

const full = (post) => ({
  ...post,
  summary: "En az dört hafta önce başla: teklif al, kolileri topla, abonelikleri taşı.",
  content,
  faq: [
    { question: "Taşınmaya ne zaman hazırlanmalıyım?", answer: "En az dört hafta önce başlamanı öneririz." },
    { question: "Kaç koli gerekir?", answer: "2+1 bir ev için ortalama 40-50 koli yeterlidir." },
  ],
  seoTitle: null,
  seoDescription: null,
  noindex: false,
  author,
  images: {},
});

const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  if (path === "/v1/blog/posts") {
    const page = Number(url.searchParams.get("page") ?? 1);
    const items = page === 1 ? posts : [];
    return json(res, 200, { items, total: posts.length, page, totalPages: 1 });
  }
  const postMatch = path.match(/^\/v1\/blog\/posts\/([a-z0-9-]+)$/);
  if (postMatch) {
    const post = posts.find((p) => p.slug === postMatch[1]);
    return post ? json(res, 200, full(post)) : json(res, 404, { message: "Yazı bulunamadı" });
  }
  if (path === "/v1/blog/categories") return json(res, 200, [category]);
  if (path === `/v1/blog/categories/${category.slug}`) return json(res, 200, category);
  if (path === `/v1/blog/authors/${author.slug}`) return json(res, 200, { ...author, postCount: posts.length });
  if (path === "/v1/blog/index") {
    return json(res, 200, {
      posts: posts.map((p) => ({ ...p, noindex: false, lastModified: p.updatedAt })),
      categories: [category],
      authors: [{ slug: author.slug, name: author.name, updatedAt: posts[0].updatedAt }],
    });
  }
  if (path === `/v1/public-media/blog/${FILE}` || path === `/v1/public-media/blog/${THUMB}`) {
    res.writeHead(200, { "Content-Type": "image/jpeg", "Content-Length": IMAGE.length, "Cache-Control": "public, max-age=31536000, immutable" });
    return res.end(IMAGE);
  }
  if (path.startsWith("/v1/blog/")) return json(res, 404, { message: "Bulunamadı" });
  json(res, 503, { message: "Sahte API: yalnızca blog" });
}).listen(PORT, () => console.log(`Sahte blog API'si: http://localhost:${PORT}`));
