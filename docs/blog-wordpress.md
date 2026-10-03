# Blog: WordPress editör, site vitrin

Yazılar WordPress'te (`cms.evdenevenakliyat.app`) yazılır, okur onları sitenin kendi tasarımıyla `evdenevenakliyat.app/blog` altında görür. WordPress'in kendi sayfaları arama motorlarına kapalıdır ve ziyaretçiyi siteye yönlendirir; aynı yazı iki adreste görünüp birbirini zayıflatmaz.

```
Yazar → cms.evdenevenakliyat.app/wp-admin (WordPress, sadece yönetim)
            │  REST API: /wp-json/wp/v2/posts, /categories
            │  Yayınlayınca → POST evdenevenakliyat.app/api/blog/yenile
            ▼
Okur  → evdenevenakliyat.app/blog/... (Next.js)
```

## Sitedeki adresler

| Adres | İçerik |
|---|---|
| `/blog` | Son yazılar (12'şer), kategori bağlantıları |
| `/blog/sayfa/2` | Sonraki sayfalar |
| `/blog/<yazi-kisa-adi>` | Yazı: içindekiler (3+ ara başlık varsa), yazar, tarih, okuma süresi, ilgili yazılar |
| `/blog/kategori/<kategori>` | Kategorinin yazıları (`/sayfa/2` ile devam) |
| `/blog/rss.xml` | RSS (son 30 yazı) |

Yazılar ve kategoriler `sitemap.xml`'e kendiliğinden girer. Yazı yokken `/blog` "yakında" mesajı gösterir ve dizine kapalıdır (`noindex`).

**Yapısal veri:** yazıda `BlogPosting` (yazar, yayın ve güncelleme tarihi, görsel, kategori), listede `Blog`, her sayfada `BreadcrumbList`.

## Kurulum (bir kez)

### 1. WordPress'i kur

1. cPanel (eski PHP paketi) → **Domains** → `cms.evdenevenakliyat.app` alt alan adını ekle, SSL'in (AutoSSL) açık olduğunu kontrol et.
2. cPanel → **WordPress Toolkit / Softaculous** → WordPress'i `cms.evdenevenakliyat.app` adresine kur. Dil: Türkçe.
3. WordPress → **Ayarlar → Okuma** → "Arama motorlarının bu siteyi dizine eklemesini engelle" kutusunu işaretle.
4. **Ayarlar → Kalıcı bağlantılar** → **Yazı adı** seç, kaydet.
5. **Ayarlar → Genel** → Saat dilimi: **İstanbul**.

### 2. Eklentiyi yükle

1. Repodaki [`docs/wordpress/nakliyat-headless.php`](wordpress/nakliyat-headless.php) dosyasını indir.
2. cPanel → **File Manager** → WordPress klasöründe `wp-content/mu-plugins/` klasörünü aç (yoksa oluştur), dosyayı oraya yükle. Ayrıca etkinleştirmen gerekmez; **Eklentiler → Zorunlu kullanılanlar** altında görünür.
3. Rastgele uzun bir anahtar üret (en az 32 harf ve rakam; ör. bir şifre yöneticisiyle). Bu anahtarı kimseyle paylaşma, sohbete yazma.
4. File Manager → `wp-config.php` → **Edit**. `/* That's all, stop editing! */` satırının **üstüne** ekle:

   ```php
   define('NAKLIYAT_SITE_URL', 'https://evdenevenakliyat.app');
   define('NAKLIYAT_YENILEME_ANAHTARI', 'BURAYA_ANAHTAR');
   ```

Eklenti şunları yapar: yazı yayınlanınca/güncellenince/silinince siteye haber verir; `cms.` adresindeki yazı sayfalarını sitedeki karşılığına yönlendirir ve arama motorlarına kapatır; paneldeki "Yazıyı görüntüle" sitedeki adresi açar; yeni yazının kısa adındaki Türkçe harfleri sadeleştirir (`taşınma` → `tasinma`). Yönetim paneli, önizleme ve REST API etkilenmez.

### 3. Siteye WordPress adresini ver

1. cPanel (Junior.js paketi) → **Setup Node.js App** → **nakliyat-web** → Environment variables:
   - `WORDPRESS_URL` = `https://cms.evdenevenakliyat.app`
   - `BLOG_REVALIDATE_SECRET` = 2. adımdaki anahtarın aynısı
   
   Kaydet ve **Restart**.
2. GitHub → repo → **Settings → Environments → production → Variables** → `WORDPRESS_URL` = `https://cms.evdenevenakliyat.app`. Böylece her sürümde `/blog` sayfası yazılarla birlikte hazırlanır.

### 4. Dene

1. WordPress'te bir yazı yayınla (kategori ve öne çıkan görsel seç).
2. `https://evdenevenakliyat.app/blog` adresini aç: yazı birkaç saniye içinde listede olmalı.
3. `https://cms.evdenevenakliyat.app/<yazi-adi>/` adresini aç: sitedeki yazıya yönlenmeli.

Yazı görünmezse: anahtarın iki yerde aynı olduğunu ve `WORDPRESS_URL`'in `https://` ile başladığını kontrol et. Bildirim ulaşmasa bile içerik en geç bir saatte kendiliğinden yenilenir.

## Yazarken

- **SEO açıklaması:** Yoast SEO kuruluysa yazının Yoast "Meta açıklaması" kullanılır, yoksa yazının özeti. Sayfa başlığı her zaman yazı başlığıdır.
- **Başlıklar:** yazının içinde H2 ve H3 kullan (H1 yazı başlığıdır, içerikteki H1'ler H2'ye çevrilir). Üç veya daha fazla H2 varsa yazının başında içindekiler çıkar.
- **İlk paragraf:** sorunun cevabını ilk paragrafta net ver; yapay zekâ yanıtları ve Google öne çıkan sonuçlar buradan alıntılar ([seo-geo.md](seo-geo.md)).
- **Görseller:** WordPress medya kütüphanesinden gelir, WordPress'in ürettiği küçük boyutlar telefonda kullanılır. Öne çıkan görseli yatay (16:9) seç, en az 1200 px genişlik. Alternatif metni doldur.
- **Bağlantılar:** WordPress içinde verilen yazı ve kategori bağlantıları sitedeki adrese çevrilir.
- **Gösterilmeyenler:** sitenin güvenliği ve hızı için betik, iframe (YouTube vb. gömme), form ve özel stil/sınıflar yazı içinde gösterilmez. Metin, liste, tablo, alıntı, görsel ve bağlantılar görünür.
- **Yazar kutusu:** WordPress → Kullanıcılar → profil → "Biyografik bilgi" doldurulursa yazının altında yazar tanıtımı çıkar (E-E-A-T).

## Teknik notlar

- Kod: `apps/web/src/lib/blog/` (WordPress istemcisi, içerik temizleme), `apps/web/src/app/(site)/blog/`, `apps/web/src/app/api/blog/yenile/route.ts`.
- İçerik `sanitize-html` ile izin listesinden geçirilir; yalnızca belirli etiket ve nitelikler kalır.
- Önbellek: WordPress yanıtları `blog` etiketiyle bir saat tutulur. `/api/blog/yenile` (anahtarla) etiketi ve derlemede üretilen sayfaları hemen geçersiz kılar; sonraki ziyaretçi yeni içeriği görür.
- WordPress'e ulaşılamazsa liste sayfaları boş görünür; yazı sayfaları önbellekteki son hâliyle açılmaya devam eder.
- Testler: `apps/web/e2e/blog.spec.ts`, sahte WordPress `apps/web/e2e/wordpress-mock.mjs`. PageSpeed ölçümü (`lighthouse.yml`) blog listesini ve bir yazıyı da ölçer.
