# İl kapak görselleri

İl sayfalarının kapak fotoğrafları Wikimedia Commons'tan, yalnızca serbest lisanslı (CC0, kamu malı, CC BY, CC BY-SA) dosyalardan seçildi. Her fotoğrafın altında fotoğrafçı ve lisans yazılır (lisans şartı).

1. `aday-indir.mjs`: her il için simge yapısına göre arama yapar ve 4 aday indirir (500 px).
2. Adaylar gözle incelendi; seçilen fotoğraf, alt metin ve SEO'ya uygun dosya adı `secilenler.json`'da.
3. `indir.mjs`: seçilenlerin 1920 px boyunu ve güncel atıf bilgisini indirir.
4. `donustur.py`: 3:2 kırpar, 1440 px ve 800 px WebP üretir (üst veri silinir) ve `apps/api/il-kapaklari/manifest.json`'u yazar.

Canlıda /yonetim/sayfalar → "İl görsellerini ekle" düğmesi yalnızca kapağı boş il sayfalarına ekler.
Wikimedia, bulut ortamının IP adresine sıkı istek sınırı uyguladığı için indirme adımları kullanıcının bilgisayarında çalıştırıldı.
