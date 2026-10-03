# Talep fotoğraf ve videoları, firma belgeleri

Müşteri talep açarken (ve sonra talep sayfasından) eşyalarının fotoğrafını veya videosunu ekler. Firmalar bunları talep ayrıntısında görür; adres ve iletişim bilgisi yine gizlidir.

## Sunucuya yük binmemesi için

- **Küçültme tarayıcıda yapılır.** Sunucu (2 çekirdek / 2 GB) hiçbir görüntü veya video işlemez.
  - Fotoğraf: en uzun kenar 1600 px, WebP (eski Safari'de JPEG). 12 MP telefon fotoğrafı ~4 MB → ~200-400 KB.
  - Video: en uzun kenar 1280 px (720p), ~1,2 Mbit/sn, en fazla 60 sn. 60 sn ≈ 9 MB. H.264 MP4; tarayıcı H.264 kodlayamıyorsa VP9 WebM. Kütüphane ([mediabunny](https://mediabunny.dev)) yalnızca video seçildiğinde indirilir, sayfa açılışını ve PageSpeed'i etkilemez.
  - Yeniden kodlama, fotoğraftaki ve videodaki konum (GPS) bilgisini de siler.
- **Dosya API üzerinden kaydedilir:** API 30 dakikalık imzalı yükleme adresi verir (`PUT /v1/files/upload/:token`), tarayıcı dosyayı buraya gönderir. Dosyalar tarayıcıda küçültüldüğü için (≤ 3 MB / ≤ 30 MB) yük azdır. Boyut belirtece dahildir; bildirilenden büyük dosya kabul edilmez.
  - Neden doğrudan R2'ye değil: tarayıcıdan R2'ye yüklemede R2, CORS ön kontrolünü (OPTIONS) `403 NotEntitled` ile reddetti (2026-10-02, CORS kuralı doğru olmasına rağmen). API üzerinden aktarımda CORS gerekmez.
- **Sınırlar** (talep başına): 10 fotoğraf (her biri en fazla 3 MB), 2 video (her biri en fazla 30 MB). Kural dosyaları: `apps/api/src/media/media-rules.ts`, `apps/web/src/lib/media/rules.ts`.
- Görüntüleme adresleri imzalı ve 1-2 saat geçerli; sayfa her açıldığında yenisi üretilir.
- Hesap silinince (yönetim paneli) müşterinin tüm talep dosyaları depodan da silinir.

## Depolama: hibrit (Cloudflare R2 + sunucu diski)

Her dosyanın nerede durduğu veritabanında tutulur (`RequestMedia.storage`, `CompanyDocument.storage`: `R2` ya da `LOCAL`). Talep dosyaları ve firma belgeleri aynı şekilde çalışır.

1. Gelen dosya önce sunucu diskine geçici olarak yazılır, sonra R2'ye aktarılır ve geçici dosya silinir.
2. **R2 kullanılamazsa dosya sunucu diskinde kalır** (`~/yuklemeler`): R2 ayarlı değilse, hata verirse (ör. `403 NotEntitled`), 60 sn içinde cevap vermezse ya da R2 kotası dolduysa. Müşteri farkı görmez. R2 hata verince 10 dakika denenmez (her yükleme beklemesin), loga ve Sentry'ye `R2'ye yazılamadı ...` düşer.
3. **R2 düzelince taşıma otomatik:** API 10 dakikada bir diskteki dosyaları (her seferinde 20 tane, eskiden yeniye) R2'ye kopyalar, kaydı günceller, sonra diskteki kopyayı siler. Logda `N dosya sunucu diskinden R2'ye taşındı`.

API açılırken `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` dördü de doluysa R2 kullanılır; değilse yalnızca sunucu diski.

**Ücret güvencesi:** R2'de toplam boyut 9,5 GB'a ulaşınca R2'ye yükleme durur (ücretsiz katman 10 GB), yeni dosyalar sunucu diskine gider; o da dolunca yükleme kapanır. Müşteri talebini yine fotoğrafsız açabilir, loga ve Sentry'ye hata düşer. Sınır `R2_QUOTA_GB` ile değiştirilebilir. Cloudflare'in kendisinde harcama tavanı yok; sınırı bu kod uygular.

**Sunucu diski:** dosyalar `~/yuklemeler` klasörüne yazılır (uygulama klasörünün dışında, sürüm kurulumunda silinmez). Paketin diski 2 GB olduğu için diskteki toplam boyut `LOCAL_UPLOAD_QUOTA_MB` (varsayılan 400 MB) ile sınırlı. Bu klasör veritabanı yedeğine dahil değildir.

**Cloudflare R2'ye geçiş** (ücretsiz katman: 10 GB depolama, indirme ücreti yok):

1. dash.cloudflare.com'da hesap aç → **R2 Object Storage** → **Create bucket**, ad: `nakliyat-medya`, konum: Avrupa (EEUR). Bucket herkese açık yapılmaz.
2. CORS kuralı gerekmez (yükleme API üzerinden, görüntüleme `<img>`/`<video>` ile yapılır).
3. R2 ana sayfası → **Manage R2 API Tokens** → **Create API token**: izin **Object Read & Write**, yalnızca `nakliyat-medya` bucket'ı. Çıkan **Access Key ID** ve **Secret Access Key**'i bir kez gösterir; sohbete veya dosyaya yazma, doğrudan cPanel'e gir.
4. cPanel → **Setup Node.js App** → `nakliyat-api` → ortam değişkenleri: `R2_ACCOUNT_ID` (Cloudflare panelinin sağındaki Account ID), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=nakliyat-medya` → **Save** → **Restart**.
5. Kontrol: bir talebe fotoğraf ekle; talep sayfasındaki görselin adresi `r2.cloudflarestorage.com` ile başlamalı. `api.evdenevenakliyat.app/v1/files/...` ile başlıyorsa dosya diskte kalmıştır: API logunda `R2'ye yazılamadı ...` satırı R2'nin cevabını gösterir (`grep -h "R2'ye" ~/nakliyat-api/*.log | tail -3`).

Geçişten önce diske yüklenmiş dosyalar R2 çalışınca otomatik taşınır.

## Testler

- API: `apps/api/test/media.e2e-spec.ts` (yerel disk sürücüsüyle yükleme, imza, sınırlar, yetki), `src/media/s3-presign.spec.ts` (R2 imzası, AWS örnek değerleriyle), `src/media/storage.spec.ts` (R2'ye aktarım ve hibrit depo, sahte sunucuyla), `test/media-hybrid.e2e-spec.ts` (R2 hata verirken diske kayıt, R2 düzelince taşıma).
- Tarayıcı: `apps/web/e2e/talep-medya.spec.ts` (fotoğraf küçültme + yükleme + silme, video küçültme + yükleme).

## Firma belgeleri

Firmalar doğrulama için belge yükler (firma paneli → Belgeler). Aynı depo ve aynı yükleme akışı kullanılır,
dosyalar `firmalar/<firmaId>/` altında durur ve toplam boyut sınırına (kota) talep dosyalarıyla birlikte sayılır.

- Zorunlu: K3 yetki belgesi (geçerlilik bitiş tarihiyle), vergi levhası, ticaret sicil gazetesi / faaliyet belgesi.
  İsteğe bağlı: sigorta poliçesi, en fazla 5 ek belge.
- PDF, JPG, PNG ya da WebP; en fazla 10 MB. Belgeler küçültülmez.
- Belgeleri yalnızca firma sahibi ve yönetici kısa süreli imzalı adresle görür.
- Yönetici her belgeyi ayrı onaylar ya da gerekçeyle reddeder. Zorunlu belgelerin hepsi onaylı ve süresi geçerli
  olmadan firma onaylanamaz.
- Onaylı K3'ün süresi dolarsa firma teklif veremez; yeni K3 yüklenip onaylanınca devam eder.
- Hesap silinince belgeler depodan da silinir.

## Firma tanıtım görselleri (logo ve fotoğraflar)

Firma paneli → **Tanıtım sayfası**. Aynı depo ve yükleme akışı (`firmalar/<firmaId>/`), toplam boyut sınırına sayılır.

- Tarayıcıda küçültülür: fotoğraf 1600 px + 480 px önizleme (iki dosya), logo 192 px; WebP (eski Safari'de JPEG), konum bilgisi silinir.
- En fazla 12 fotoğraf ve 1 logo (yeni logo eskisinin yerini alır). Kurallar: `apps/api/src/companies/showcase-rules.ts`, `apps/web/src/lib/showcase.ts`.
- Belgelerden farkı: **herkese açık ve kalıcı adres**. Site görseli kendi alan adından verir: `/medya/firmalar/<firmaId>/<dosya>` → web (`app/medya/.../route.ts`) → API `GET /v1/public-media/firmalar/...` → R2 ya da disk. Tarayıcıda bir yıl önbellekte kalır (dosya adı rastgele, içerik değişmez).
- Yalnızca onaylı firmanın ve yönetimin gizlemediği görseller herkese açık adresten gelir; firma paneli ve yönetim önizlemeyi imzalı kısa süreli adresten görür.
- Yönetici firma inceleme ekranından görseli gerekçeyle gizler (firma gerekçeyi panelde görür) ya da yeniden yayınlar.
- Hesap silinince görseller depodan da silinir.
