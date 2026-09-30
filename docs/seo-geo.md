# SEO ve GEO Rehberi

**SEO:** Google'da üst sıralarda çıkmak.
**GEO (Generative Engine Optimization):** ChatGPT, Claude, Perplexity ve Google AI yanıtlarında kaynak olarak gösterilmek.

İkisi büyük ölçüde aynı temele dayanır: hızlı, sunucuda üretilmiş HTML, net yapı, güvenilir ve özgün veri.

## Kodda hazır olanlar

| Özellik | Dosya |
|---|---|
| `robots.txt`: paneller kapalı, yapay zekâ tarayıcıları açık | `apps/web/src/app/robots.ts` |
| `sitemap.xml` | `apps/web/src/app/sitemap.ts` |
| `llms.txt`: yapay zekâ modelleri için site özeti | `apps/web/public/llms.txt` |
| Organization + WebSite yapısal verisi (JSON-LD) | `apps/web/src/app/layout.tsx` |
| Başlık şablonu, açıklama, canonical, Open Graph, `lang="tr"` | `apps/web/src/app/layout.tsx` |

## Sayfa türlerine göre kurallar

| Sayfa | Oluşturma | Yapısal veri | GEO için içerik |
|---|---|---|---|
| Ana sayfa | Statik | Organization, WebSite | "Nasıl çalışır" adımları, kısa net tanım |
| Şehir / ilçe (`/istanbul-evden-eve-nakliyat`) | Statik + günlük yenileme (ISR) | Service, BreadcrumbList, FAQPage | **Platform verisinden gerçek fiyat aralıkları** (ör. "Kadıköy 2+1 ortalama teklif: 18.000-26.000 TL, son 90 gün, 142 teklif"), bölgedeki firma sayısı, sık sorulan sorular |
| Firma profili (`/firma/[ad]`) | ISR | MovingCompany, AggregateRating, Review | Hizmet bölgeleri, tamamlanan iş sayısı, belge doğrulama tarihi |
| Blog yazısı (`/blog/[slug]`) | ISR, WordPress'te yayınlanınca anında yenilenir | Article, BreadcrumbList, yazar | Soruya ilk paragrafta net cevap, tablo ve listeler, güncelleme tarihi |
| Paneller | Dinamik | Yok | `noindex`, robots'ta kapalı |

**Neden gerçek veri önemli:** Yapay zekâ motorları genel "taşınma ipuçları" metinlerini değil, başka yerde bulunmayan sayısal veriyi kaynak gösterir. Platformdaki teklif verisi bizim en büyük GEO avantajımız olacak.

## Blog: WordPress editör, Next.js vitrin

```
Yazar → cms.evdenevenakliyat.app (WordPress, sadece yönetim)
                │  REST API: /wp-json/wp/v2/posts
                ▼
Okur  → evdenevenakliyat.app/blog/... (Next.js, sitenin kendi tasarımı)
```

- WordPress `cms.` alt alan adında kurulur. Ayarlar → Okuma → **"Arama motorlarının siteyi dizine eklemesini engelle"** işaretlenir. Böylece aynı içerik iki adreste görünüp birbirini zayıflatmaz. Yazıların canonical adresi her zaman `evdenevenakliyat.app/blog/...` olur.
- SEO başlığı ve açıklaması WordPress'te **Yoast SEO** ile girilir. Yoast bunları REST API'de `yoast_head_json` alanında verir, Next.js bu alanı kullanır.
- Yazı yayınlanınca WordPress bir webhook ile Next.js'e haber verir, sayfa saniyeler içinde güncellenir.
- Görseller WordPress medya kütüphanesinden gelir. Next.js bunları optimize edip sunar.

## Yayına çıkmadan önce kontrol listesi

- [ ] Google Search Console ve Bing Webmaster Tools'a site ve sitemap eklendi
- [ ] Google İşletme Profili açıldı
- [ ] Core Web Vitals (PageSpeed Insights) mobilde yeşil
- [ ] Yapısal veri [Rich Results Test](https://search.google.com/test/rich-results) ile doğrulandı
- [ ] Her sayfada tek H1, benzersiz başlık ve açıklama
- [ ] `cms.` alt alan adı arama motorlarına kapalı
- [ ] Hakkımızda, iletişim ve firma doğrulama süreci sayfaları yayında (güvenilirlik sinyali)
