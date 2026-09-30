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

## Yerel SEO altyapısı

Türkiye'nin 81 ili, 973 ilçesi ve iller arası karayolu mesafeleri `packages/locations` paketinde (kaynak: PTT ve KGM verisi, `turkey-neighbourhoods`, MIT). Güncellemek için: `pnpm --filter @nakliyat/locations data:update`.

### Adres yapısı

| Sayfa | Adres | Örnek |
|---|---|---|
| Merkez | `/evden-eve-nakliyat` | 81 ilin listesi |
| İl | `/{il}-evden-eve-nakliyat` | `/istanbul-evden-eve-nakliyat` |
| İlçe | `/{il}-{ilce}-evden-eve-nakliyat` | `/istanbul-kadikoy-evden-eve-nakliyat` |
| Şehirler arası | `/{nereden}-{nereye}-sehirler-arasi-nakliyat` | `/istanbul-ankara-sehirler-arasi-nakliyat` |

İlçe adresinde il adı da bulunur, çünkü aynı isimde birden fazla ilçe var (ör. birçok ilde "Merkez" veya "Yenişehir").

### Hangi sayfalar dizine açık?

Toplam ~7.500 sayfa üretilebilir (81 il + 973 ilçe + 6.480 rota). Hepsini birden açmak Google'ın **ince içerik / doorway sayfası** cezasına yol açabilir. Bu yüzden:

- **81 il sayfası:** açık
- **İlçe ve şehirler arası sayfalar:** yalnızca lansman illerinde açık (varsayılan: İstanbul, Ankara, İzmir, Bursa, Kocaeli, Antalya). Bugün toplam **253 sayfa** dizinde.
- Diğerleri çalışır ama `noindex, follow` taşır, site haritasında yer almaz.
- Lansman listesi `NEXT_PUBLIC_LAUNCH_CITIES` ortam değişkeniyle genişletilir. Kural: bir bölgede gerçek teklif verisi birikince o bölgeyi aç.

### Her sayfada

- Tek H1, benzersiz başlık ve açıklama, canonical adres
- Yapısal veri: `Service` (hizmet bölgesi ile), `BreadcrumbList`, `FAQPage`
- Şehirler arası sayfalarda gerçek karayolu mesafesi ve yol süresi
- İç linkler: il → ilçeler, yakın iller ve rotalar; ilçe → il ve diğer ilçeler; rota → iki il ve ters yön
- **Bölge verisi bölümü:** API'de istatistik uç noktası yazılınca doğrulanmış firma sayısı ve ev tipine göre gerçek teklif aralıkları otomatik görünür (`apps/web/src/lib/local-stats.ts`). Veri yokken uydurma rakam gösterilmez.

### Harita sonuçları neden hedef değil?

Biz yerel bir işletme değil, ulusal bir platformuz. Harita sonuçları (local pack) fiziksel adresi olan işletmeler içindir; orada platformdaki firmalar görünür. Biz il ve ilçe sayfalarıyla **organik sonuçlarda** ve yapay zekâ yanıtlarında kaynak olarak görünmeyi hedefliyoruz. Şirketin gerçek adresi için tek bir İşletme Profili yalnızca marka güveni için açılır; il başına sanal adres açılmaz (Google kurallarına aykırı).

## Otorite stratejisi

Hedef: "evden eve nakliyat" konusunda Türkiye'de Google'ın ve yapay zekâ motorlarının ilk başvurduğu kaynak olmak. Otorite dört ayak üzerinde kurulur:

### 1. Özgün veri (en güçlü ayak)

Başka hiçbir sitede olmayan, platformun kendi verisi:

| İçerik | Sıklık | Nerede |
|---|---|---|
| **Türkiye Taşınma Fiyat Endeksi**: il ve ev tipine göre ortalama teklif, yıllık değişim | Üç ayda bir rapor | `/rapor/tasinma-fiyat-endeksi-2026-q4` |
| Bölge sayfalarında canlı fiyat aralıkları | Günlük | İl, ilçe ve rota sayfaları |
| Taşınma yoğunluğu takvimi (hangi ay, hangi gün pahalı) | Yıllık | Rehber sayfası |

Her veri sayfasında yöntem açıklaması, örneklem büyüklüğü ve güncelleme tarihi bulunur. Basın ve yapay zekâ motorları kaynak olarak bu sayfaları gösterir.

### 2. Konu kümeleri (topical authority)

Her ana konu için bir kapsamlı rehber sayfası ve ona bağlı alt yazılar (blog, WordPress'ten):

| Ana rehber | Alt konular |
|---|---|
| Evden eve nakliyat fiyatları | ev tipine göre fiyat, şehirler arası fiyat, ek hizmet ücretleri, kapora ve ödeme |
| Taşınma rehberi | taşınma kontrol listesi, paketleme, abonelik nakil işlemleri, adres değişikliği (e-Devlet) |
| Nakliyat firması seçimi | K3 yetki belgesi nedir, sözleşmede nelere bakılmalı, sigorta, dolandırıcılık uyarıları |
| Özel eşya taşıma | piyano, beyaz eşya, antika, ofis taşıma |
| Firmalar için | K3 belgesi nasıl alınır, teklif hazırlama, müşteri memnuniyeti |

### 3. Araçlar (tekrar ziyaret ve doğal bağlantı getirir)

- **Taşınma maliyeti hesaplayıcı** (platform verisine dayalı tahmini aralık)
- **Eşya hacmi (m³) hesaplayıcı**
- **Taşınma kontrol listesi** (yazdırılabilir, tarih bazlı)
- **Firma doğrulama sorgusu**: K3 belge numarasıyla firma ara

### 4. Güven sinyalleri (E-E-A-T)

- Yazar profilleri: sektör deneyimi olan yazarlar ve editörler, her yazıda imza ve güncelleme tarihi
- `/hakkimizda`, `/yayin-ilkeleri`, `/firma-dogrulama-sureci`, `/veri-yontemi` sayfaları
- Organization yapısal verisinde ülke çapında hizmet bölgesi ve uzmanlık alanları (hazır); sosyal medya, basın ve Wikidata profilleri açıldıkça `sameAs` alanına eklenir
- Dijital PR: fiyat endeksi raporları haber sitelerine veri kaynağı olarak sunulur

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
