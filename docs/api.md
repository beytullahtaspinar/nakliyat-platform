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

Talep ve firma kayıtlarında il **plaka koduyla** (`"34"`), ilçe **adres koduyla** (`"kadikoy"`) tutulur; yanıtlarda okunabilir adlar da döner.

### Müşteri: taşıma talepleri

| Durum | Yöntem | Yol | Kim | Açıklama |
|---|---|---|---|---|
| ✅ | POST | `/requests` | Müşteri | Talep oluştur. İl-ilçe uyumu ve tarih (en erken yarın, en geç 1 yıl) kontrol edilir. Sistem m³, ekip, süre tahmini ve şehirler arası ise karayolu mesafesi ekler. Teklif toplama süresi taşınma tarihine kadar, en fazla 30 gün. |
| ✅ | GET | `/requests` | Müşteri | Kendi talepleri |
| ✅ | GET | `/requests/:id` | Müşteri | Talep detayı |
| ✅ | PATCH | `/requests/:id` | Müşteri | Teklif gelmeden önce düzenleme |
| ✅ | POST | `/requests/:id/cancel` | Müşteri | Açık talebi iptal et |

Başka bir müşterinin talebine erişim 404 döner (talep kimliği tahminiyle bilgi sızmaz). Teklif gelmiş talep düzenlenemez (409).
| ⏳ | POST | `/requests/:id/photos` | Müşteri | Fotoğraf yükleme adresi al (S3 imzalı URL) |
| ✅ | GET | `/requests/:id/quotes` | Müşteri | Gelen teklifler (firma puanı, tamamlanan iş, doğrulama rozeti ile) |
| ✅ | POST | `/quotes/:id/accept` | Müşteri | Teklifi kabul et → iş (booking) oluşur, diğer teklifler reddedilir, firmanın iletişim bilgisi açılır. Aynı anda iki kabul engellenir. |

### Firma

| Durum | Yöntem | Yol | Kim | Açıklama |
|---|---|---|---|---|
| ✅ | POST · GET | `/company/profile` | Firma | Firma profilini oluştur / görüntüle (vergi no benzersiz) |
| ✅ | PATCH | `/company/profile` | Firma | Profili güncelle. Unvan, vergi no veya K3 no değişirse firma yeniden doğrulamaya düşer. |
| ⏳ | POST | `/company/documents` | Firma | K3, vergi levhası vb. belge yükle |
| ✅ | GET · GET | `/company/requests`, `/company/requests/:id` | Firma | Hizmet bölgesindeki açık talepler. Müşteri adı ve açık adres gizli. |
| ✅ | POST | `/company/requests/:id/quotes` | Doğrulanmış firma | Teklif ver (talep başına bir teklif, yalnızca hizmet bölgesindeki taleplere) |
| ✅ | PATCH | `/company/quotes/:id` | Firma | Bekleyen teklifi güncelle. Her fiyat değişikliği geçmişe kaydedilir. |
| ✅ | POST | `/company/quotes/:id/withdraw` | Firma | Teklifi geri çek |
| ✅ | GET | `/company/quotes` | Firma | Verdiği teklifler |
| ✅ | GET | `/company/bookings` | Firma | Kazandığı işler (müşteri iletişim bilgisi ve açık adres burada açılır) |
| ⏳ | POST | `/company/bookings/:id/complete` | Firma | İşi tamamlandı olarak işaretle |
| ⏳ | POST | `/company/reviews/:id/reply` | Firma | Yoruma yanıt ver |

### Ortak

| Durum | Yöntem | Yol | Kim | Açıklama |
|---|---|---|---|---|
| ⏳ | GET | `/companies/:id` | Herkes | Firmanın herkese açık profili ve yorumları |
| ✅ | GET | `/bookings` | Müşteri | Anlaşılan işler, firmanın iletişim bilgisiyle |
| ⏳ | GET | `/bookings/:id` | Taraflar | İş detayı |
| ⏳ | POST | `/bookings/:id/review` | Müşteri | Tamamlanan işe puan ve yorum |
| ⏳ | GET · POST | `/quotes/:id/messages` | Taraflar | Teklif üzerinden yazışma |
| ⏳ | GET · POST | `/bookings/:id/messages` | Taraflar | İş üzerinden yazışma |
| ✅ | GET | `/notifications` | Giriş yapmış | Uygulama içi bildirimler, okunmamış sayısıyla (`unread`) |
| ✅ | POST | `/notifications/:id/read` · `/notifications/read-all` | Giriş yapmış | Okundu işaretle |
| ✅ | GET · PATCH | `/notifications/preferences` | Giriş yapmış | Bildirim e-postası ve tür/kanal bazında aç-kapa ([bildirimler.md](bildirimler.md)) |

### Admin

| Durum | Yöntem | Yol | Açıklama |
|---|---|---|---|
| ✅ | GET | `/admin/summary` | Yönetim özeti: bekleyen firma, açık talep, kullanıcı, planlanmış iş sayıları |
| ✅ | GET | `/admin/companies?status=PENDING` | Doğrulama bekleyen firmalar |
| ✅ | GET | `/admin/companies/:id` | Firma inceleme: sahibi, belgeleri, teklif/iş sayısı, karar geçmişi |
| ✅ | POST | `/admin/companies/:id/verify` · `/reject` | Firmayı onayla veya reddet (gerekçeyle) |
| ⏳ | PATCH | `/admin/documents/:id` | Belgeyi onayla/reddet |
| ✅ | GET | `/admin/requests?status=` | Tüm talepler, müşteri iletişimiyle |
| ✅ | GET | `/admin/users?role=&q=` | Kullanıcılar; ad, telefon veya e-postada arama |
| ⏳ | GET | `/admin/quotes` · `/admin/bookings` | Listeleme ve arama |
| ⏳ | POST | `/admin/users/:id/suspend` | Kullanıcıyı askıya al |
| ⏳ | PATCH | `/admin/reviews/:id` | Uygunsuz yorumu yayından kaldır |
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
