# Hata Takibi ve İzleme

## Hata kodu ile log bulma

Kullanıcı "hata aldım" dediğinde ekranda bir **hata kodu** görür:

| Kod nerede görünür | Neyi gösterir | Log'da ara |
|---|---|---|
| API hata yanıtında `requestId` (ör. `7f3a9c1b2d4e`), web formlarında "(hata kodu: ...)" | API isteği | `nakliyat-api/stderr.log` içinde `"requestId":"7f3a9c1b2d4e"` |
| Web hata sayfasında "hata kodu" (ör. `2841773093`) | Sunucuda oluşan web hatası | `nakliyat-web/stderr.log` içinde `"digest":"2841773093"` |

Her hata log'a tek satır JSON olarak yazılır (`level`, `service`, `release`, `eventId`, `requestId`, `path`, `message`, `stack`). cPanel Terminal'de:

```bash
grep '"requestId":"7f3a9c1b2d4e"' ~/nakliyat-api/*.log
grep '"level":"error"' ~/nakliyat-web/*.log | tail -20
```

İstek gövdesi, telefon, adres, çerez ve başlıklar loglanmaz (KVKK). Sorgu dizeleri adreslerden atılır.

## Ne raporlanır?

| Kaynak | Nasıl |
|---|---|
| API'de beklenmeyen hatalar (5xx) | Global hata filtresi (`apps/api/src/observability`). 4xx (yanlış şifre, doğrulama hatası) beklenen durumdur, raporlanmaz. |
| API'de istek dışı hatalar | `unhandledRejection` / `uncaughtException` |
| Web sunucusu (sayfa, Server Action, route) | `apps/web/src/instrumentation.ts` → `onRequestError` |
| Tarayıcı | `apps/web/src/instrumentation-client.ts` ve hata sayfaları, `/api/hata-bildirimi` adresine gönderir. Tarayıcıya izleme kütüphanesi yüklenmez (PageSpeed etkilenmez); sayfa başına en fazla 5, IP başına dakikada 10 bildirim. |
| Yavaş API istekleri (>1 sn) | `"Yavaş istek"` uyarı satırı |

## Sentry'yi açmak (önerilir, ücretsiz katman yeter)

1. sentry.io'da hesap aç, **Node.js** türünde `nakliyat` adlı bir proje oluştur. Bölge olarak AB (Frankfurt) seç.
2. Project Settings → Client Keys (DSN) → DSN'i kopyala.
3. cPanel → Setup Node.js App → **nakliyat-api** ve **nakliyat-web** uygulamalarının ikisine de ortam değişkeni ekle: `SENTRY_DSN` = kopyaladığın değer. Kaydet ve **Restart**.
4. Sentry → Alerts: "Yeni bir hata türü görüldüğünde e-posta gönder" kuralı (varsayılan olarak açık gelir).

Her olayda sürüm (`surum-N`), servis (`api`/`web`), istek kimliği ve kullanıcı rolü (müşteri/firma/admin) etiket olarak görünür; kişisel veri gönderilmez. Dakikada en fazla 30 olay gönderilir (hata fırtınasında kota dolmasın).

DSN boşsa her şey yine log'a yazılır; Sentry yalnızca e-posta bildirimi ve gruplama ekler.

## Çalışma izleme (uptime)

UptimeRobot veya Better Stack'te (ücretsiz) iki HTTP(S) izleyici aç, 1 dakika aralıkla, "keyword" türünde `"status":"ok"` aransın:

- `https://api.evdenevenakliyat.app/v1/health` (veritabanı bağlantısı dahil)
- `https://evdenevenakliyat.app/api/saglik`

Site ya da veritabanı düşerse e-posta/SMS gelir.

## Sürüm bilgisi

Her canlı paket `surum-N` etiketiyle üretilir (`RELEASE` dosyası). Sağlık adresleri, Sentry olayları ve loglar bu etiketi taşır; bir hatanın hangi sürümle geldiği ve `deploy.sh`'in yeni sürümü gerçekten açtığı buradan anlaşılır.
