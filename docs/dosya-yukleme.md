# Talep fotoğraf ve videoları

Müşteri talep açarken (ve sonra talep sayfasından) eşyalarının fotoğrafını veya videosunu ekler. Firmalar bunları talep ayrıntısında görür; adres ve iletişim bilgisi yine gizlidir.

## Sunucuya yük binmemesi için

- **Küçültme tarayıcıda yapılır.** Sunucu (2 çekirdek / 2 GB) hiçbir görüntü veya video işlemez.
  - Fotoğraf: en uzun kenar 1600 px, WebP (eski Safari'de JPEG). 12 MP telefon fotoğrafı ~4 MB → ~200-400 KB.
  - Video: en uzun kenar 1280 px (720p), ~1,2 Mbit/sn, en fazla 60 sn. 60 sn ≈ 9 MB. H.264 MP4; tarayıcı H.264 kodlayamıyorsa VP9 WebM. Kütüphane ([mediabunny](https://mediabunny.dev)) yalnızca video seçildiğinde indirilir, sayfa açılışını ve PageSpeed'i etkilemez.
  - Yeniden kodlama, fotoğraftaki ve videodaki konum (GPS) bilgisini de siler.
- **Dosya API'den geçmez** (R2'de): API yalnızca 30 dakikalık imzalı yükleme adresi verir, tarayıcı dosyayı doğrudan depoya gönderir. Boyut imzaya dahildir; bildirilenden büyük dosya yüklenemez.
- **Sınırlar** (talep başına): 10 fotoğraf (her biri en fazla 3 MB), 2 video (her biri en fazla 30 MB). Kural dosyaları: `apps/api/src/media/media-rules.ts`, `apps/web/src/lib/media/rules.ts`.
- Görüntüleme adresleri imzalı ve 1-2 saat geçerli; sayfa her açıldığında yenisi üretilir.
- Hesap silinince (yönetim paneli) müşterinin tüm talep dosyaları depodan da silinir.

## Depolama: Cloudflare R2 (önerilen) veya sunucu diski

API açılırken `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` dördü de doluysa R2 kullanılır, değilse sunucu diski.

**Ücret güvencesi:** R2'de toplam boyut 9,5 GB'a ulaşınca yeni yükleme durur (ücretsiz katman 10 GB). Müşteri talebini yine fotoğrafsız açabilir, loga ve Sentry'ye hata düşer. Sınır `R2_QUOTA_GB` ile değiştirilebilir. Cloudflare'in kendisinde harcama tavanı yok; sınırı bu kod uygular.

**Sunucu diski** (R2 kurulana kadar): dosyalar `~/yuklemeler` klasörüne yazılır (uygulama klasörünün dışında, sürüm kurulumunda silinmez). Paketin diski 2 GB olduğu için toplam boyut `LOCAL_UPLOAD_QUOTA_MB` (varsayılan 400 MB) ile sınırlı; dolunca yükleme kapanır, talep yine fotoğrafsız açılabilir ve loga uyarı düşer. Bu klasör veritabanı yedeğine dahil değildir.

**Cloudflare R2'ye geçiş** (ücretsiz katman: 10 GB depolama, indirme ücreti yok):

1. dash.cloudflare.com'da hesap aç → **R2 Object Storage** → **Create bucket**, ad: `nakliyat-medya`, konum: Avrupa (EEUR). Bucket herkese açık yapılmaz.
2. Bucket → **Settings** → **CORS Policy** → şunu yapıştır:
   ```json
   [{ "AllowedOrigins": ["https://evdenevenakliyat.app"], "AllowedMethods": ["PUT", "GET", "HEAD"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```
3. R2 ana sayfası → **Manage R2 API Tokens** → **Create API token**: izin **Object Read & Write**, yalnızca `nakliyat-medya` bucket'ı. Çıkan **Access Key ID** ve **Secret Access Key**'i bir kez gösterir; sohbete veya dosyaya yazma, doğrudan cPanel'e gir.
4. cPanel → **Setup Node.js App** → `nakliyat-api` → ortam değişkenleri: `R2_ACCOUNT_ID` (Cloudflare panelinin sağındaki Account ID), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=nakliyat-medya` → **Save** → **Restart**.
5. Kontrol: bir talebe fotoğraf ekle; talep sayfasındaki görselin adresi `r2.cloudflarestorage.com` ile başlamalı.

Geçişten önce diske yüklenmiş dosyalar R2'ye otomatik taşınmaz; canlıda henüz dosya yoksa bir şey yapmaya gerek yok.

## Testler

- API: `apps/api/test/media.e2e-spec.ts` (yerel disk sürücüsüyle yükleme, imza, sınırlar, yetki), `src/media/s3-presign.spec.ts` (R2 imzası, AWS örnek değerleriyle).
- Tarayıcı: `apps/web/e2e/talep-medya.spec.ts` (fotoğraf küçültme + yükleme + silme, video küçültme + yükleme).
