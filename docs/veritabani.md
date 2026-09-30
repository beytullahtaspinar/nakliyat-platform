# Veritabanı Modeli

Şema: [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma)

| Tablo | Amaç |
|---|---|
| `User` | Tüm kullanıcılar. Rol: müşteri, firma, admin. Telefon zorunlu ve benzersiz (OTP ile doğrulanır). |
| `RefreshToken` | JWT yenileme anahtarları (hash olarak saklanır). |
| `Company` | Nakliyat firması profili, hizmet verdiği şehirler, doğrulama durumu, puan özeti. |
| `CompanyDocument` | K3 yetki belgesi, vergi levhası, ticaret sicil gibi doğrulama belgeleri. |
| `Vehicle` | Firma araçları (MVP'de opsiyonel). |
| `MovingRequest` | Müşterinin taşıma talebi: adresler, kat, asansör, ev tipi, tarih, ek hizmetler, sistemin hesapladığı m³ / ekip / süre. |
| `RequestPhoto` | Talebe eklenen fotoğraflar. |
| `Quote` | Firmanın teklifi. Bir firma bir talebe yalnızca bir teklif verebilir. |
| `Booking` | Müşterinin kabul ettiği teklif, yani anlaşılan iş. |
| `Review` | İş tamamlandıktan sonra müşterinin puanı ve yorumu, firmanın yanıtı. |
| `Message` | Teklif veya iş üzerinden müşteri-firma yazışması. |
| `Notification` | Uygulama içi, SMS ve e-posta bildirimleri. |
| `AuditLog` | Admin işlemlerinin kaydı. |

## Kurallar

- Silme işlemleri `deletedAt` ile yapılır (soft delete).
- Para tutarları `Decimal(10,2)` ve TL cinsindendir.
- Müşterinin iletişim bilgisi firmaya ancak teklif kabul edildikten sonra gösterilir.
- Şema değişikliği her zaman migration ile yapılır: `pnpm db:migrate`.
