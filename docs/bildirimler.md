# Bildirimler

Kullanıcılara giden bildirimler tek bir modülden çıkar: `apps/api/src/notifications`. Şu an
**uygulama içi** ve **e-posta (Brevo)** kanalları çalışıyor. SMS ve mobil uygulama bildirimi (push)
aynı yapıya yeni bir kanal olarak eklenecek.

## Nasıl çalışır

```
Teklif modülü ──emit('quote.created')──▶ DomainEvents ──▶ NotificationsListener
                                                              │ alıcıyı ve içeriği bulur
                                                              ▼
                                                     NotificationsService.notify()
                                                              │ 1. IN_APP kaydı (her zaman)
                                                              │ 2. kullanıcının açık tuttuğu her kanal:
                                                              ▼    kayıt (PENDING) → gönder → SENT / FAILED / SKIPPED
                                                     BrevoEmailChannel  (ileride SmsChannel, PushChannel)
```

- İş modülleri bildirimden habersizdir; yalnızca olay yayınlar (`src/events/domain-events.ts`).
  Bildirim hatası talebi, teklifi veya kabulü asla bozmaz.
- Başarısız gönderimler 5 dakikada bir, en fazla 3 kez yeniden denenir (24 saatten eski olanlar denenmez).
  Üçüncü hata Sentry'ye düşer.
- Müşterinin açık adresi ve kimliği firmaya giden bildirimlere girmez; yalnızca il/ilçe ve tarih.

| Tür | Kime | Ne zaman |
|---|---|---|
| `NEW_REQUEST` | Firma | Çıkış veya varış ili, firmanın hizmet bölgesindeyse ve firma doğrulanmışsa |
| `NEW_QUOTE` | Müşteri | Talebine teklif geldiğinde |
| `QUOTE_ACCEPTED` | Müşteri ve firma | Teklif kabul edilip iş oluştuğunda |
| `REVIEW_REQUEST` | Müşteri | Firma işi tamamlandı olarak işaretlediğinde (firmayı değerlendirme daveti) |
| `NEW_REVIEW` | Firma | Müşteri puan/yorum verdiğinde |
| `COMPANY_VERIFICATION` | Firma | Yönetici firmayı onayladığında veya reddettiğinde |

Kullanıcılar `/hesabim/bildirimler` ve `/firma-paneli/bildirimler` sayfalarından bildirim e-postasını
girer ve her türü kanal bazında kapatabilir (KVKK). Uygulama içi bildirimler kapatılamaz.

## Brevo kurulumu (bir kez)

1. [brevo.com](https://www.brevo.com) üzerinde ücretsiz hesap aç (günde 300 e-posta).
2. **Gönderen alan adını doğrula:** Brevo → *Senders, Domains & Dedicated IPs* → *Domains* →
   `evdenevenakliyat.app` ekle. Brevo'nun verdiği DNS kayıtlarını (Brevo kodu TXT, DKIM, DMARC)
   alan adının DNS yönetimine (Veridyen cPanel → *Zone Editor*) ekle ve Brevo'da *Verify* de.
   Doğrulanmamış alan adından giden e-postalar spam'e düşer veya hiç gitmez.
3. **Gönderen ekle:** *Senders* → `bildirim@evdenevenakliyat.app`, ad `evdenevenakliyat.app`.
4. **API anahtarı oluştur:** sağ üst menü → *SMTP & API* → *API Keys* → *Generate a new API key*.
   Anahtarı kimseyle paylaşma, sohbete veya dosyaya yazma.
5. **Sunucuya ekle:** cPanel → *Setup Node.js App* → API uygulaması (`nakliyat-api`) → *Environment variables*:
   - `BREVO_API_KEY` = oluşturduğun anahtar
   - `MAIL_FROM_EMAIL` = `bildirim@evdenevenakliyat.app`
   - `MAIL_FROM_NAME` = `evdenevenakliyat.app`
   - `WEB_URL` = `https://evdenevenakliyat.app` (e-postadaki bağlantılar bu adrese gider; zaten tanımlı olmalı)

   Kaydet ve **Restart**'a bas.
6. Brevo tanımadığı IP adresinden gelen API isteklerini engelleyebilir. İlk e-postadan sonra Brevo'dan
   "yeni IP adresi" uyarısı gelirse onayla, ya da *Security → Authorised IPs* ekranına sunucunun IP
   adresini ekle (cPanel ana sayfasında *Shared IP Address*). Aksi halde gönderimler `FAILED`
   kalır ve `lastError` alanında `Brevo 401` görünür.

`BREVO_API_KEY` tanımlı değilse API çalışmaya devam eder, e-postalar gönderilmez ve `SKIPPED`
olarak kaydedilir. Yerel geliştirme ve CI bu şekilde çalışır.

## Kontrol

Gönderim durumu veritabanında görülebilir (phpMyAdmin):

```sql
SELECT createdAt, type, status, attempts, lastError
FROM Notification WHERE channel = 'EMAIL' ORDER BY createdAt DESC LIMIT 20;
```

Brevo panelindeki *Transactional → Logs* ekranı da her e-postanın teslim, açılma ve geri dönme
(bounce) durumunu gösterir. E-postalar türüne göre etiketlenir (`NEW_QUOTE` vb.).

## Yeni kanal eklemek (SMS, push)

1. `src/notifications/channels/` altına `ChannelProvider` arayüzünü uygulayan bir sınıf yaz
   (`send()` geçici hatada hata fırlatır, adres yoksa `SKIPPED` döner).
2. `notifications.module.ts` içindeki `NOTIFICATION_CHANNELS` listesine ekle.
3. `notification-types.ts` içindeki `OPTIONAL_CHANNELS` listesine kanalı ekle; tercih ekranı
   kendiliğinden yeni bir onay kutusu gösterir.
4. Push için cihaz anahtarlarını saklayan bir tablo (`PushDevice`) ve kayıt ucu gerekir; mobil
   uygulama (veya PWA) geldiğinde eklenecek.

## Yeni bildirim türü eklemek

1. `notification-types.ts` → türü, etiketini ve hangi rollerin göreceğini ekle.
2. `templates.ts` → içerik şablonunu yaz.
3. İlgili modülde olayı yayınla (`DomainEventMap`'e ekleyerek) ve `notifications.listener.ts` içinde dinle.
