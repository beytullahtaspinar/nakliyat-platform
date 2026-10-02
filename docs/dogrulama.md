# E-posta ve telefon doğrulaması

Kod: `apps/api/src/verification`. Ekran: `apps/web/src/app/(site)/dogrulama`.

## Nasıl çalışır

- Kayıtta e-posta zorunludur (web formları). Kayıt olunca e-postaya **6 haneli kod** gider ve kullanıcı
  `/dogrulama` ekranına yönlenir.
- Kod **10 dakika** geçerlidir, **tek kullanımlıktır**. Yeni kod istenince eskisi geçersiz olur.
- **5 hatalı denemede** kod kilitlenir, yeni kod istenmelidir. Yeni kod **60 saniyede bir**,
  kanal başına günde en fazla **10 kez** istenebilir.
- Kodun kendisi veritabanında saklanmaz; `VerificationCode.codeHash` alanında HMAC-SHA256 özeti
  (`JWT_ACCESS_SECRET` anahtarıyla) tutulur.
- E-posta adresi değişirse (bildirim ayarları, yönetim ekranı ya da doğrulama ekranında "Adresi
  değiştir") yeni adres yeniden doğrulanmalıdır. Doğrulama ekranında yeni adres, kod onaylanınca hesaba yazılır.

### Doğrulama ne zaman gerekir

| İşlem | Doğrulanmamış hesapta |
|---|---|
| Talep oluşturma | Talep **taslak** kalır, firmalara gösterilmez. Doğrulama bitince otomatik yayına girer ve firmalara "yeni talep" bildirimi o zaman gider. |
| Teklif kabulü (müşteri) | Reddedilir (403), doğrulama ekranına yönlendirilir |
| Teklif verme (firma) | Reddedilir (403) |

"Doğrulanmış" = e-posta doğrulandı **ve** telefon sağlayıcısı bağlıysa telefon da doğrulandı.
Telefon sağlayıcısı bağlı değilken telefon doğrulaması istenmez.

## Telefon sağlayıcısı (sonradan bağlanacak)

Sağlayıcı `PHONE_OTP_PROVIDER` ortam değişkeniyle seçilir. Tanımlı değilse telefon adımı ekranda
görünmez. Değişkenler cPanel → *Setup Node.js App* → API uygulaması → *Environment variables*
bölümüne eklenir, sonra **Restart**.

### Netgsm SMS

1. Netgsm hesabı aç, SMS başlığını (ör. `EVDENEVENKL`) onaylat, **OTP SMS** paketini etkinleştir.
2. Netgsm panelinde API alt kullanıcısı oluştur ve sunucunun IP adresine izin ver.
3. Ortam değişkenleri:
   - `PHONE_OTP_PROVIDER` = `netgsm`
   - `NETGSM_USERCODE` = abone numarası ya da API alt kullanıcısı
   - `NETGSM_PASSWORD` = API şifresi
   - `NETGSM_HEADER` = onaylı SMS başlığı
4. Kendi numaranla dene. Hata olursa `Sentry` ve API logunda `Netgsm <kod>: <açıklama>` görünür.

SMS metni Türkçe karakter içermez (OTP hattı desteklemiyor) ve `@evdenevenakliyat.app #123456`
satırıyla biter: Android Chrome kodu ekrandaki alana kendisi doldurur (WebOTP), iPhone klavyesi öneri olarak gösterir.

> Netgsm entegrasyonu Netgsm'in REST v2 OTP ucuna (`/sms/rest/v2/otp`) göre yazıldı, gerçek hesapla
> henüz denenmedi. Hesap açılınca ilk gönderimi birlikte kontrol edelim.

### WhatsApp (Meta WhatsApp Cloud API)

1. [Meta Business](https://business.facebook.com) hesabı aç, işletmeyi doğrulat.
2. WhatsApp Business hesabına telefon numarası ekle (o numara normal WhatsApp'ta kullanılamaz).
3. *Message templates* → **Authentication** kategorisinde `dogrulama_kodu` adlı, dili **Türkçe**
   olan, **Copy code** düğmeli bir şablon oluştur ve onaylat.
4. Kalıcı erişim anahtarı için *System users* → anahtar oluştur (`whatsapp_business_messaging` izni).
5. Ortam değişkenleri:
   - `PHONE_OTP_PROVIDER` = `whatsapp`
   - `WHATSAPP_TOKEN` = erişim anahtarı
   - `WHATSAPP_PHONE_NUMBER_ID` = numaranın *Phone number ID* değeri
   - isteğe bağlı `WHATSAPP_OTP_TEMPLATE` (varsayılan `dogrulama_kodu`), `WHATSAPP_OTP_LANGUAGE` (varsayılan `tr`)

## E-posta

Bildirimlerle aynı Brevo hesabını kullanır (`BREVO_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`;
bkz. [bildirimler.md](bildirimler.md)). Kod e-postası kullanıcının bildirim tercihlerinden etkilenmez.
Konu satırında kod yer aldığı için Gmail "Kodu kopyala" düğmesini kendisi gösterir.

`BREVO_API_KEY` yoksa canlıda (`NODE_ENV=production`) kod gönderilemez ve kullanıcı hata görür;
geliştirmede kod API loguna yazılır.

## Geliştirme ve testler

- `VERIFICATION_TEST_CODE=424242` tüm kodları sabitler (tarayıcı testleri bunu kullanır).
  `NODE_ENV=production` iken yok sayılır.
- `PHONE_OTP_PROVIDER=log` telefon adımını geliştirmede açar; kod loga yazılır. Canlıda yok sayılır.

## Kontrol

```sql
SELECT channel, target, attempts, expiresAt, consumedAt, createdAt
FROM VerificationCode ORDER BY createdAt DESC LIMIT 20;
```
