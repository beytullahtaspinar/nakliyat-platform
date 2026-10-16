# Blog

Taşınma rehberleri yönetim panelinden yazılır ve sitede `evdenevenakliyat.app/blog` altında yayınlanır.
Ayrı bir CMS yoktur: yazılar, kategoriler, yazarlar ve görseller aynı API ve veritabanındadır.
Yönetimdeki her değişiklik karar geçmişine (AuditLog, `blog.*`) yazılır.

## Yönetim ekranları

| Ekran | Adres |
|---|---|
| Yazılar (Tümü / Yayında / Zamanlanmış / Taslak) | `/yonetim/blog` |
| Yeni yazı, yazıyı düzenle | `/yonetim/blog/yeni`, `/yonetim/blog/<id>` |
| Kategoriler | `/yonetim/blog/kategoriler` |
| Yazarlar | `/yonetim/blog/yazarlar` |

Editörde:

- **Başlık**: sayfadaki tek H1. Okurun Google'a yazacağı soruyu içersin.
- **Adres**: başlıktan üretilir. Yayındaki yazının adresi değişirse eski adres yenisine kalıcı (301) yönlenir.
- **Özet**: liste kartında görünür; arama açıklaması boşsa Google'da da bu görünür.
- **Kısaca**: yazının başındaki kutu. Sorunun 2-3 cümlelik net cevabı (GEO: yapay zekâ yanıtları çoğunlukla buradan alıntılar).
- **İçerik**: Markdown (araç çubuğu ve önizleme var). `##` ara başlık, `###` alt başlık; tek `#` kullanılmaz.
  En az 3 ara başlık olunca yazının başında içindekiler çıkar.
- **Sık sorulan sorular**: yazının sonunda ve `FAQPage` yapısal verisinde görünür.
- **Yayın tarihi (TSİ)**: boşsa "Yayınla" hemen yayınlar; ileri bir tarih o saatte yayınlar (site en geç 15 dakikada yenilenir).
- **Önemli güncelleme**: yayındaki yazıda bilgi değiştiyse işaretlenir; sayfada ve yapısal veride "güncellendi" tarihi ilerler.
- **SEO ve GEO kontrolü**: yayından önce eksikleri sarı gösterir (zorunlu değil).

Yayınlamak için zorunlu olanlar: özet en az 50, içerik en az 600 karakter, kapak varsa açıklaması (alt metin),
içerikte H1 olmaması.

## Sitede

| Sayfa | Adres | Yapısal veri |
|---|---|---|
| Blog | `/blog`, `/blog/sayfa/<n>` | Blog, BreadcrumbList |
| Kategori | `/blog/kategori/<ad>` | Blog, BreadcrumbList |
| Yazar | `/blog/yazar/<ad>` | ProfilePage + Person (unvan, özgeçmiş, sameAs) |
| Yazı | `/blog/<ad>` | BlogPosting (yazar, tarihler, kelime sayısı, abstract), FAQPage, BreadcrumbList |
| RSS | `/blog/rss.xml` | |

Yazılar site haritasında (kapak görseliyle), `llms.txt`'de (başlık + özet) ve RSS'te listelenir.
"Arama motorlarına kapalı" işaretli yazılar site haritasına ve llms.txt'ye girmez.

Eski adres yönlendirmesi sayfada değil `proxy.ts`'de yapılır (`lib/blog/redirect.ts`, API `GET /v1/blog/redirects/<ad>`):
önbellekteki sayfa yönlendirmeye dönüşünce Next.js 16 Location başlığını iki kez yazıp 404'e düşürüyor.

Önbellek: blog verisi `blog` etiketiyle 15 dakika önbellekte; yönetimde kaydedilince hemen yenilenir (`lib/actions/blog.ts`).

## Görseller

Görseller tarayıcıda küçültülür (1600 px + 800 px önizleme, WebP; konum bilgisi silinir), talep ve firma
dosyalarıyla aynı depoya (Cloudflare R2, olmazsa sunucu diski) yüklenir ve sitenin kendi adresinden sunulur:
`/medya/blog/<dosya>.webp`. Yazıda ya da yazar profilinde kullanılan görsel kütüphaneden silinemez.

## Kod

- API: `apps/api/src/blog/` (herkese açık `/v1/blog/*`, yönetim `/v1/admin/blog/*`)
- Site: `apps/web/src/lib/blog/`, `apps/web/src/app/(site)/blog/`, `apps/web/src/components/blog/`
- Yönetim: `apps/web/src/app/yonetim/blog/`
- Testler: `apps/api/test/blog.e2e-spec.ts`, `apps/web/e2e/blog.spec.ts`
