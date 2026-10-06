# API Tasarımı

- Temel adres: `https://api.evdenevenakliyat.app/v1` (yerelde `http://localhost:4000/v1`)
- Canlı dokümantasyon (Swagger): `/docs`, JSON şema: `/docs-json`
- Şemanın repodaki kopyası: [`docs/openapi.json`](openapi.json) (`pnpm --filter @nakliyat/api openapi:export` ile güncellenir)

## Genel kurallar

| Konu | Kural |
|---|---|
| Kimlik | `Authorization: Bearer <accessToken>`. Erişim anahtarı 15 dk, yenileme anahtarı 30 gün geçerli ve tek kullanımlık. |
| Roller | `CUSTOMER`, `COMPANY`, `ADMIN`. Admin hesabı dışarıdan kayıtla açılamaz. |
| Doğrulama | Tüm girdiler DTO ile doğrulanır; tanımsız alan gönderilirse 400. |
| Hız sınırı | Genel: IP başına dakikada 120 istek. Kayıt/giriş/yenileme: dakikada 10. Aşılırsa 429. |
| Telefon | Her biçimde kabul edilir, `+905XXXXXXXXX` olarak saklanır. |
| Para | TL, iki ondalık basamak, string olarak döner (`"12500.00"`). |
| Sayfalama | `?page=1&limit=20`, yanıt: `{ items, total, page, limit }` |
| Hata biçimi | `{ statusCode, message, error }`. `message` kullanıcıya gösterilebilir Türkçe metindir. |

## Uç noktalar

Durum: ✅ yazıldı ve test edildi · ⏳ planlandı

### Sistem

| Durum | Yöntem | Yol | Kim | Açıklama |
|---|---|---|---|---|
| ✅ | GET | `/health` | Herkes | Uygulama ve veritabanı durumu |

### Kimlik doğrulama

| Durum | Yöntem | Yol | Kim | Açıklama |
|---|---|---|---|---|
| ✅ | POST | `/auth/register` | Herkes | Müşteri veya firma kaydı |
| ✅ | POST | `/auth/login` | Herkes | Telefon + şifre ile giriş |
| ✅ | POST | `/auth/refresh` | Herkes | Yeni anahtar çifti al (eski anahtar geçersizleşir; tekrar kullanılırsa tüm oturumlar kapanır) |
| ✅ | POST | `/auth/logout` | Herkes | Yenileme anahtarını iptal eder |
| ✅ | GET | `/auth/me` | Giriş yapmış | Oturumdaki kullanıcı |
| ⏳ | POST | `/auth/otp/send` | Giriş yapmış | Telefona SMS kodu gönder (SMS sağlayıcısı seçilince) |
| ⏳ | POST | `/auth/otp/verify` | Giriş yapmış | Telefonu doğrula |
| ⏳ | POST | `/auth/password/forgot` · `/auth/password/reset` | Herkes | SMS ile şifre sıfırlama |

### İl ve ilçeler

| Durum | Yöntem | Yol | Kim | Açıklama |
|---|---|---|---|---|
| ✅ | GET | `/locations/cities` | Herkes | 81 il: plaka kodu, ad, adres kodu |
| ✅ | GET | `/locations/cities/:code/districts` | Herkes | İlin ilçeleri (ad ve adres kodu) |
| ✅ | GET | `/pricing` | Herkes | Fiyat hesaplayıcı katsayıları ve platform anlaşmalarıyla ayarlama (`calibration.local` / `.intercity`, yeterli anlaşma yoksa boş). Fiyat tarayıcıda `@nakliyat/pricing` ile hesaplanır |

Talep ve firma kayıtlarında il **plaka koduyla** (`"34"`), ilçe **adres koduyla** (`"kadikoy"`) tutulur; yanıtlarda okunabilir adlar da döner.

### Müşteri: taşıma talepleri

| Durum | Yöntem | Yol | Kim | Açıklama |
|---|---|---|---|---|
| ✅ | POST | `/requests` | Müşteri | Talep oluştur. İl-ilçe uyumu ve tarih (en erken yarın, en geç 1 yıl) kontrol edilir. Sistem m³, ekip, süre tahmini ve şehirler arası ise karayolu mesafesi ekler. İsteğe bağlı `fromLat/fromLng/toLat/toLng` (haritadaki işaret, Türkiye içi) gelirse iki nokta arası kamyon yolu `routeKm/routeMinutes` bir kez hesaplanır (docs/harita.md). Teklif toplama süresi taşınma tarihine kadar, en fazla 30 gün. |
| ✅ | GET | `/requests` | Müşteri | Kendi talepleri |
| ✅ | GET | `/requests/:id` | Müşteri | Talep detayı |
| ✅ | PATCH | `/requests/:id` | Müşteri | Teklif gelmeden önce düzenleme |
| ✅ | POST | `/requests/:id/cancel` | Müşteri | Açık talebi iptal et |

Başka bir müşterinin talebine erişim 404 döner (talep kimliği tahminiyle bilgi sızmaz). Teklif gelmiş talep düzenlenemez (409).
| ✅ | POST | `/requests/:id/media/uploads` | Müşteri | Küçültülmüş fotoğraf/video için kısa süreli yükleme adresleri ([dosya-yukleme.md](dosya-yukleme.md)) |
| ✅ | POST · DELETE | `/requests/:id/media`, `/requests/:id/media/:mediaId` | Müşteri | Yüklenen dosyaları talebe bağla / sil (yalnızca açık talep) |
| ✅ | GET | `/requests/:id/quotes` | Müşteri | Gelen teklifler (firma puanı, tamamlanan iş, doğrulama rozeti ile) |
| ✅ | POST | `/quotes/:id/accept` | Müşteri | Teklifi kabul et → iş (booking) oluşur, diğer teklifler reddedilir, firmanın iletişim bilgisi açılır. Aynı anda iki kabul engellenir. |

### Firma

| Durum | Yöntem | Yol | Kim | Açıklama |
|---|---|---|---|---|
| ✅ | POST · GET | `/company/profile` | Firma | Firma profilini oluştur / görüntüle (vergi no benzersiz) |
| ✅ | PATCH | `/company/profile` | Firma | Profili güncelle. Unvan, vergi no veya K3 no değişirse firma yeniden doğrulamaya düşer. |
| ✅ | GET · POST · DELETE | `/company/documents`, `/company/documents/uploads` | Firma | Doğrulama belgeleri: K3 (geçerlilik tarihiyle), vergi levhası, ticaret sicil zorunlu; sigorta ve ek belge isteğe bağlı. PDF/JPG/PNG/WebP, en fazla 10 MB. Yükleme akışı talep medyasıyla aynı (docs/dosya-yukleme.md). Onaylı belge silinmez, yenisi onaylanınca yerini alır. |
| ✅ | GET · GET | `/company/requests`, `/company/requests/:id` | Firma | Hizmet bölgesindeki açık talepler. Müşteri adı ve açık adres gizli. Süzgeç: `quoted=yes\|no`, `city=34` |
| ✅ | POST | `/company/requests/:id/quotes` | Doğrulanmış firma | Teklif ver (talep başına bir teklif, yalnızca hizmet bölgesindeki taleplere) |
| ✅ | PATCH | `/company/quotes/:id` | Firma | Bekleyen teklifi güncelle. Her fiyat değişikliği geçmişe kaydedilir. |
| ✅ | POST | `/company/quotes/:id/withdraw` | Firma | Teklifi geri çek |
| ✅ | GET | `/company/quotes` | Firma | Verdiği teklifler. Süzgeç: `status=PENDING\|ACCEPTED\|REJECTED\|EXPIRED\|WITHDRAWN` |
| ✅ | GET · GET | `/company/bookings`, `/company/bookings/:id` | Firma | Kazandığı işler (müşteri iletişim bilgisi ve açık adres burada açılır). Süzgeç: `status`, `q` (müşteri adı/telefonu) |
| ✅ | GET | `/company/customers?q=` | Firma | Müşterileri: iş sayısı, planlı iş, iptal edilmeyen işlerin toplamı, son iş. Ekran: /firma-paneli/musteriler |
| ✅ | GET | `/company/overview` | Firma | Pano: açık/teklifsiz talep, bekleyen teklif, kazanma oranı (90 gün), 7 günlük iş, bu ay/geçen ay ciro (TSİ), puan. Ekran: /firma-paneli |
| ✅ | GET | `/company/bookings/calendar?from=&to=` | Firma | Takvim: iki gün arasındaki işler (YYYY-AA-GG, TSİ, en fazla 42 gün). Açık adres içermez. Ekran: /firma-paneli/takvim (ay/hafta) |
| ✅ | GET | `/company/reviews` | Firma | Aldığı değerlendirmeler (gizlenenler gerekçesiyle) ve puan özeti `{ summary: { ratingAverage, ratingCount, distribution } }` |
| ✅ | POST | `/company/reviews/:id/reply` | Firma | Yoruma bir kez yanıt (2-1000 karakter); yorumun altında herkese açık görünür |

### Ortak

| Durum | Yöntem | Yol | Kim | Açıklama |
|---|---|---|---|---|
| ✅ | GET | `/companies?reviewed=true` | Herkes | Doğrulanmış firmalar, en çok yorum alan önce (site haritası) |
| ✅ | GET | `/companies/:id` · `/companies/:id/reviews` | Herkes | Firmanın herkese açık profili, puan dağılımı ve yayındaki yorumlar (müşteri adı "Ayşe Y." biçiminde). Yalnızca doğrulanmış, etkin firmalar. |
| ✅ | GET | `/bookings` | Müşteri | Anlaşılan işler, firmanın iletişim bilgisiyle |
| ⏳ | GET | `/bookings/:id` | Taraflar | İş detayı |
| ✅ | POST | `/bookings/:id/complete` | Taraflar | İşi tamamlandı olarak işaretle; taşınma günü gelmeden yapılamaz. Talep de tamamlanır. Firma tamamlarsa müşteriye `REVIEW_REQUEST` gider. |
| ✅ | POST | `/bookings/:id/cancel` | Taraflar | Anlaşılan işi gerekçeyle (`reason`, 5-500 karakter) iptal et; taşınma gününün sonuna kadar. Talep de iptal olur, mesajlaşma kapanır, karşı tarafa `BOOKING_CANCELLED` gider. Kimin iptal ettiği denetim kaydında (`booking.cancel`). |
| ✅ | POST | `/bookings/:id/review` | Müşteri | Tamamlanan işe 1-5 puan ve isteğe bağlı yorum (10-2000 karakter); iş başına bir kez, değiştirilemez. Firmaya `NEW_REVIEW` gider. ([degerlendirmeler.md](degerlendirmeler.md)) |
| ✅ | GET · POST | `/bookings/:id/messages` | Taraflar | İş üzerinden yazışma (teklif kabulünden sonra). GET karşı tarafın mesajlarını okundu sayar (yönetici firma görünümünde saymaz). Mesaj 1-2000 karakter; iptal edilen işte salt okunur. Karşı tarafa okunmamışların ilki için `NEW_MESSAGE` bildirimi gider. |
| ✅ | GET | `/messages/unread` | Müşteri, Firma | Okunmamış mesajlar: `{ total, items: [{ bookingId, requestId, count }] }` |
| ✅ | GET | `/notifications` | Giriş yapmış | Uygulama içi bildirimler, okunmamış sayısıyla (`unread`) |
| ✅ | POST | `/notifications/:id/read` · `/notifications/read-all` | Giriş yapmış | Okundu işaretle |
| ✅ | GET · PATCH | `/notifications/preferences` | Giriş yapmış | Bildirim e-postası ve tür/kanal bazında aç-kapa ([bildirimler.md](bildirimler.md)) |

### Admin

| Durum | Yöntem | Yol | Açıklama |
|---|---|---|---|
| ✅ | GET | `/admin/summary` | Yönetim özeti: bekleyen firma, açık talep, kullanıcı, planlanmış iş sayıları |
| ✅ | GET | `/admin/stats?days=7\|30\|90` | İstatistikler (varsayılan 30 gün, Türkiye saatiyle gün): önceki eşit dönemle karşılaştırılan toplamlar, dönemde açılan taleplerin teklif → iş → tamamlanma hunisi, talep başına teklif, anlaşma tutarı, puan dağılımı, en çok talep gelen 10 il, günlük talep/teklif/iş. Taslak talepler sayılmaz |
| ✅ | GET · PATCH | `/admin/pricing` | Fiyat hesaplayıcı katsayıları: görüntüle (varsayılanlar, dönemdeki anlaşma sayıları, ayarlama) ve değiştir (kısmi; sınırlar `PRICING_SETTING_SPECS`). Değişiklik karar geçmişine `pricing.update` olarak yazılır |
| ✅ | GET | `/admin/companies?status=&q=` | Firmalar; ad, unvan, vergi no, K3 veya sahip adı/telefonunda arama |
| ✅ | GET | `/admin/companies/:id` | Firma inceleme: sahibi, belgeleri, teklif/iş sayısı, karar geçmişi |
| ✅ | POST | `/admin/companies/:id/verify` · `/reject` | Firmayı onayla veya reddet (gerekçeyle). Onay için zorunlu belgelerin her biri onaylı ve süresi geçerli olmalı. |
| ✅ | POST | `/admin/companies/:id/documents/:documentId/approve` · `/reject` | Belgeyi onayla veya reddet (gerekçe firma panelinde görünür) |
| ✅ | GET | `/admin/documents?status=&q=` | Firma belgeleri; varsayılan onay bekleyenler (en eski önce). Onaylı firmanın yeni eklediği/yenilediği belge `replacesVerified` ile işaretli. Sayaç: `/admin/summary` → `documents.pending` |
| ✅ | GET | `/admin/requests?status=&q=` | Tüm talepler, müşteri iletişimiyle; müşteri adı/telefonunda arama |
| ✅ | GET | `/admin/requests/:id` | Talep kaydı: müşteri, tüm teklifler (fiyata göre), iş |
| ✅ | GET | `/admin/users?role=&q=` | Kullanıcılar; ad, telefon veya e-postada arama |
| ✅ | GET · PATCH | `/admin/users/:id` | Kullanıcı detayı; ad, telefon, e-posta, hesap durumu (askıya alınca oturumlar kapanır) |
| ✅ | POST | `/admin/users/:id/password` | Yeni şifre belirle; mevcut şifre hiç gösterilmez, tüm oturumlar kapanır |
| ✅ | DELETE | `/admin/users/:id` | Hesabı sil: ad, telefon, e-posta, şifre silinir; açık talepler iptal, firma listeden kalkar, bekleyen teklifler geri çekilir. Kayıtlar isimsiz kalır. Planlanmış işi olan hesap ve yönetici hesapları silinmez |
| ✅ | PATCH | `/admin/companies/:id` | Firma bilgilerini düzelt (doğrulama durumu korunur) |
| ✅ | POST | `/admin/companies/:id/impersonate` | Firma panelini firmanın gözünden aç: 30 dk geçerli, yenilenmeyen firma anahtarı. Geçiş ve bu anahtarla yapılan her değişiklik yönetici adına firmanın geçmişine yazılır; yönetici yetkisini kaybedince anahtar geçersiz olur |
| ⏳ | GET | `/admin/quotes` · `/admin/bookings` | Listeleme ve arama |
| ✅ | GET | `/admin/reviews?status=visible\|hidden&rating=&q=` | Değerlendirmeler; firma adı veya yorum metninde arama |
| ✅ | POST | `/admin/reviews/:id/hide` · `/show` | Yorumu gerekçeyle gizle (sayfadan ve ortalamadan çıkar) ya da yeniden yayına al; karar geçmişine yazılır |
| ⏳ | GET | `/admin/stats` | Dönüşüm oranları, zamana göre grafikler |

Tüm admin işlemleri `AuditLog` tablosuna kaydedilir. İlk admin hesabı sunucuda oluşturulur (dışarıdan kayıtla açılamaz):

```bash
ADMIN_PHONE=05xxxxxxxxx ADMIN_PASSWORD='en-az-12-karakter' ADMIN_NAME='Ad Soyad' pnpm --filter @nakliyat/api admin:create
```

## Talep → iş durum akışı

```
MovingRequest:  OPEN ──(teklif kabul)──▶ BOOKED ──(firma tamamladı)──▶ COMPLETED
                  │                         │
                  ├──(müşteri iptal)──▶ CANCELLED ◀──(iptal)──┘
                  └──(süre doldu)────▶ EXPIRED

Quote:  PENDING ──▶ ACCEPTED │ REJECTED (başka teklif seçildi) │ WITHDRAWN │ EXPIRED
```

## Örnek: kayıt

```http
POST /v1/auth/register
Content-Type: application/json

{ "role": "CUSTOMER", "fullName": "Ayşe Yılmaz", "phone": "0532 123 45 67", "password": "GucluSifre123" }
```

```json
{
  "user": { "id": "cm...", "role": "CUSTOMER", "fullName": "Ayşe Yılmaz", "phone": "+905321234567", "email": null, "phoneVerified": false },
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "q3V..."
}
```
