/**
 * Testler için sahte WordPress REST API (yalnızca blog sayfalarının kullandığı uçlar).
 * Gerçek WordPress'in yanıt biçimini taklit eder: /wp-json/wp/v2/posts, /categories, öne çıkan görsel.
 *
 * Çalıştırma: node e2e/wordpress-mock.mjs (varsayılan port 4100, WP_MOCK_PORT ile değişir)
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.WP_MOCK_PORT ?? 4100);
const BASE = `http://127.0.0.1:${PORT}`;
const IMAGE = readFileSync(new URL("./fixtures/oda.jpg", import.meta.url));

const categories = [
  { id: 3, slug: "tasinma-rehberi", name: "Taşınma Rehberi", description: "Taşınma öncesi ve sonrası yapılacaklar.", taxonomy: "category" },
  { id: 4, slug: "nakliyat-fiyatlari", name: "Nakliyat Fiyatları", description: "", taxonomy: "category" },
];

const media = {
  source_url: `${BASE}/wp-content/uploads/oda.jpg`,
  alt_text: "Taşınmaya hazır koliler",
  media_details: {
    width: 1200,
    height: 1600,
    sizes: {
      medium: { source_url: `${BASE}/wp-content/uploads/oda.jpg?w=300`, width: 300, height: 400 },
      thumbnail: { source_url: `${BASE}/wp-content/uploads/oda.jpg?w=150`, width: 150, height: 150 },
    },
  },
};

const content = `
<p>Taşınma kontrol listesi, taşınmadan önceki haftaları planlamanı sağlar. Kısa cevap: <strong>en az dört hafta önce</strong> başlamalısın.</p>
<h2>Dört hafta önce</h2>
<p>Nakliyat firmalarından <a href="${BASE}/nakliyat-fiyatlari-2026/">teklif al</a> ve tarihi kesinleştir.</p>
<h2>İki hafta önce</h2>
<ul><li>Kolileri topla</li><li>Abonelikleri taşı</li></ul>
<h2>Taşınma günü</h2>
<figure class="wp-block-table"><table><thead><tr><th>Ev tipi</th><th>Koli sayısı</th></tr></thead><tbody><tr><td>1+1</td><td>20-30</td></tr><tr><td>3+1</td><td>60-80</td></tr></tbody></table></figure>
<script>alert("xss")</script>
<p onclick="alert(1)" style="color:red">Güvenli paragraf</p>
<iframe src="https://example.com"></iframe>
<h1>İçerikteki başlık</h1>
`;

const author = { name: "Elif Yılmaz", description: "10 yıllık nakliyat sektörü editörü." };

function post(id, slug, title, day, cats, extra = {}) {
  return {
    id,
    slug,
    date_gmt: `2026-09-${String(day).padStart(2, "0")}T09:00:00`,
    modified_gmt: `2026-09-${String(day).padStart(2, "0")}T09:00:00`,
    title: { rendered: title },
    excerpt: { rendered: `<p>${title} hakkında bilmen gerekenler &hellip; [&hellip;]</p>` },
    content: { rendered: content },
    categories: cats,
    _embedded: {
      author: [author],
      "wp:featuredmedia": [media],
      "wp:term": [cats.map((c) => categories.find((x) => x.id === c)), []],
    },
    ...extra,
  };
}

const posts = [
  post(1, "tasinma-kontrol-listesi", "Taşınma kontrol listesi: 4 haftalık plan", 28, [3], {
    yoast_head_json: { title: "Taşınma Kontrol Listesi - Blog", description: "Taşınmadan önce dört hafta boyunca adım adım yapılacaklar." },
  }),
  post(2, "nakliyat-fiyatlari-2026", "Evden eve nakliyat fiyatları 2026", 25, [4]),
  post(3, "koli-nasil-hazirlanir", "Koli nasıl hazırlanır?", 20, [3]),
];

const withCounts = () => categories.map((c) => ({ ...c, count: posts.filter((p) => p.categories.includes(c.id)).length }));

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(body));
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", BASE);
  if (url.pathname.startsWith("/wp-content/uploads/")) {
    res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000" });
    return res.end(IMAGE);
  }
  if (url.pathname === "/wp-json/wp/v2/categories") {
    const slug = url.searchParams.get("slug");
    return send(res, 200, withCounts().filter((c) => !slug || c.slug === slug));
  }
  if (url.pathname === "/wp-json/wp/v2/posts") {
    let list = posts;
    const slug = url.searchParams.get("slug");
    if (slug) list = list.filter((p) => p.slug === slug);
    const cat = url.searchParams.get("categories");
    if (cat) list = list.filter((p) => p.categories.includes(Number(cat)));
    const perPage = Number(url.searchParams.get("per_page") ?? 10);
    const page = Number(url.searchParams.get("page") ?? 1);
    const totalPages = Math.max(1, Math.ceil(list.length / perPage));
    if (page > totalPages) return send(res, 400, { code: "rest_post_invalid_page_number" });
    const items = list.slice((page - 1) * perPage, page * perPage);
    return send(res, 200, items, { "X-WP-Total": String(list.length), "X-WP-TotalPages": String(totalPages) });
  }
  send(res, 404, { code: "rest_no_route" });
}).listen(PORT, "127.0.0.1", () => console.log(`Sahte WordPress: ${BASE}`));
