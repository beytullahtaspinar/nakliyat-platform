# Harita, adres işaretleme ve yol mesafesi

Talep formunda müşteri çıkış ve varış adresini haritada isteğe bağlı işaretler. İşaretlenirse iki nokta
arası gerçek kamyon yolu (km + süre) talep açılırken **bir kez** hesaplanıp kaydedilir. Teklifi kabul
edilen firma işler sayfasında "Yol tarifi al" ile Google veya Yandex Haritalar'ı açar.

## Kullanılan ücretsiz servisler

| İş | Servis | Anahtar | Not |
|---|---|---|---|
| Harita görüntüsü | [OpenFreeMap](https://openfreemap.org) (MapLibre GL) | Gerekmez | Sınırsız, OpenStreetMap verisi |
| Adres arama | [Photon](https://photon.komoot.io) | Gerekmez | Tarayıcıdan çağrılır, Türkiye ile sınırlı |
| Yol mesafesi/süresi | [OpenRouteService](https://openrouteservice.org) | `ORS_API_KEY` | Ücretsiz paket günde 2000 istek; yalnızca talep açılırken/adres değişince |
| Yol tarifi | Google / Yandex Haritalar bağlantısı | Gerekmez | Telefonda uygulamayı açar |

Harita kütüphanesi (~1 MB) yalnızca "Haritada işaretle" veya "Haritada göster" düğmesine basılınca
indirilir; sayfaların ilk açılışına ve PageSpeed puanına etkisi yoktur.

## Gizlilik (KVKK)

- İşaret (enlem/boylam) açık adres gibi kişisel veridir. Firmalar teklif verirken yalnızca il/ilçeyi ve
  yol uzunluğunu görür; işaret ve açık adres yalnızca teklifi kabul edilen firmaya gösterilir.
- Adres değiştirilip yeni işaret gönderilmezse eski işaret silinir.
- Adres araması tarayıcıdan Photon'a gider (yazılan adres metni). Aydınlatma metninde "harita ve adres
  arama hizmeti (OpenStreetMap tabanlı)" üçüncü taraf olarak belirtilmeli.

## OpenRouteService anahtarı (isteğe bağlı)

1. https://openrouteservice.org/dev/#/signup adresinden ücretsiz hesap aç, e-postanı doğrula.
2. Dashboard → **Tokens** → "Free" anahtar oluştur.
3. cPanel → Setup Node.js App → API uygulaması → Environment variables: `ORS_API_KEY` ekle, kaydet,
   **Restart**.

Anahtar yoksa ya da servis 5 saniyede yanıt vermezse talep yine açılır; mesafe il merkezleri arasından
(şehir içinde "Şehir içi") gösterilir. Hata API logunda `Yol hesaplanamadı (ORS ...)` olarak görünür.
