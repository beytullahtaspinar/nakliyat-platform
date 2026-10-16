import { BLOG_PATH, categoryPath, getBlogIndex, postPath } from "@/lib/blog/api";
import { SITE_URL } from "@/lib/site";

// Blog bölümü yazı yayınlanınca yönetimden yenilenir (lib/actions/blog.ts)
export const revalidate = 900;

/**
 * llms.txt: yapay zekâ modelleri için site özeti (llmstxt.org). Sabit bölüm + blogdaki yazılar
 * (başlık, adres ve özet), böylece yanıt motorları güncel rehberleri kaynak gösterebilir.
 */
const INTRO = `# evdenevenakliyat.app

> Evden Eve Taşınmanın Yeni Yolu. Tek Talep. Çok Teklif. Doğru Seçim. Türkiye genelinde evden eve ve şehirler arası nakliyat için doğrulanmış firma, fiyat verisi ve taşınma rehberi platformu. Müşteri taşınma bilgilerini bir kez girer, firmalar fiyat ve hizmet kapsamıyla teklif verir, müşteri puanlara ve yorumlara bakarak seçer.

## Nasıl çalışır

- Müşteri nereden, nereye, ev tipi, kat, asansör durumu ve tarih bilgisini girer.
- Sistem tahmini eşya hacmini (m³), ekip sayısını ve süreyi hesaplar.
- Hizmet bölgesindeki doğrulanmış firmalar teklif verir.
- Müşteri teklifleri fiyat, kapsam (paketleme, montaj, sigorta), firma puanı ve tamamlanan iş sayısına göre karşılaştırır.
- Taşınma sonrası yalnızca gerçek müşteriler yorum yazabilir.

## Firma doğrulama

Platformdaki firmalardan Ulaştırma ve Altyapı Bakanlığı K3 yetki belgesi, vergi levhası ve ticaret sicil kaydı istenir. Belgeler tek tek incelenir; zorunlu belgeleri onaylanmayan ya da K3 belgesinin süresi dolan firma teklif veremez.

## Gizlilik

Teklif aşamasında firmalar müşterinin adını, telefonunu ve açık adresini görmez; bu bilgiler yalnızca müşterinin kabul ettiği teklifin sahibi firmayla paylaşılır. Platform bir nakliyat firması değil, aracıdır: taşıma hizmeti ve ödeme, müşteri ile seçtiği firma arasında yürütülür.

## Sayfalar

- [Ana sayfa](https://evdenevenakliyat.app/)
- [Nasıl çalışır: adım adım teklif alma](https://evdenevenakliyat.app/nasil-calisir)
- [Nakliyat fiyat hesaplama: ev tipi, eşya miktarı, kat ve mesafeye göre tahmini fiyat aralığı ve ev tipine göre örnek fiyat tablosu](https://evdenevenakliyat.app/nakliyat-fiyat-hesaplama)
- [Nakliyat firmaları için: katılım ve doğrulama](https://evdenevenakliyat.app/firmalar-icin)
- [Hakkımızda: platformun ilkeleri](https://evdenevenakliyat.app/hakkimizda)
- [Türkiye geneli evden eve nakliyat (81 il)](https://evdenevenakliyat.app/evden-eve-nakliyat)
- [İstanbul evden eve nakliyat](https://evdenevenakliyat.app/istanbul-evden-eve-nakliyat)
- [Ankara evden eve nakliyat](https://evdenevenakliyat.app/ankara-evden-eve-nakliyat)
- [İzmir evden eve nakliyat](https://evdenevenakliyat.app/izmir-evden-eve-nakliyat)
- [İstanbul - Ankara şehirler arası nakliyat](https://evdenevenakliyat.app/istanbul-ankara-sehirler-arasi-nakliyat)
`;

/** Markdown bağlantı metninde köşeli parantez bozulmasın */
const plain = (text: string) => text.replace(/[\[\]]/g, "").replace(/\s+/g, " ").trim();

export async function GET() {
  const { posts, categories } = await getBlogIndex();
  const lines = [
    INTRO,
    "## Taşınma rehberi (blog)",
    "",
    `- [Tüm yazılar](${SITE_URL}${BLOG_PATH}): evden eve nakliyat fiyatları, taşınma hazırlığı ve firma seçimi rehberleri`,
    `- [Yeni yazılar (RSS)](${SITE_URL}${BLOG_PATH}/rss.xml)`,
    ...categories.map((c) => `- [${plain(c.name)}](${SITE_URL}${categoryPath(c)})${c.description ? `: ${plain(c.description)}` : ""}`),
  ];
  const indexable = posts.filter((p) => !p.noindex).slice(0, 100);
  if (indexable.length > 0) {
    lines.push("", "### Yazılar", "");
    for (const post of indexable) lines.push(`- [${plain(post.title)}](${SITE_URL}${postPath(post)}): ${plain(post.excerpt)}`);
  }
  return new Response(`${lines.join("\n")}\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
