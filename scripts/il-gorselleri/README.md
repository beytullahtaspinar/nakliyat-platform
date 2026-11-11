# İl kapak görselleri

İl sayfalarının kapak fotoğrafları Wikimedia Commons'tan, yalnızca serbest lisanslı (CC0, kamu malı, CC BY, CC BY-SA) dosyalardan seçildi. Her fotoğrafın altında fotoğrafçı ve lisans yazılır (lisans şartı).

1. `aday-indir.mjs`: her il için simge yapısına göre arama yapar ve 4 aday indirir (500 px).
2. Adaylar gözle incelendi; seçilen fotoğraf, alt metin ve SEO'ya uygun dosya adı `secilenler.json`'da.
3. `indir.mjs`: seçilenlerin 1920 px boyunu ve güncel atıf bilgisini indirir.
4. `donustur.py`: 3:2 kırpar, 1440 px ve 800 px WebP üretir (üst veri silinir) ve `apps/api/il-kapaklari/manifest.json`'u yazar.

Canlıda /yonetim/sayfalar → "İl görsellerini ekle" düğmesi yalnızca kapağı boş il sayfalarına ekler.
Wikimedia, bulut ortamının IP adresine sıkı istek sınırı uyguladığı için indirme adımları kullanıcının bilgisayarında çalıştırıldı.

## İlçe kapakları

Yalnızca dizine açık ilçe sayfaları (lansman illeri: İstanbul, Ankara, İzmir, Bursa, Kocaeli, Antalya; 142 ilçe) için yapıldı.

1. `ilce-aday-indir.mjs ilceler.json`: ilçe adıyla arama, ilçe başına 4 aday. Uygun aday çıkmayan ilçeler için `ilce-ek-arama.json`'daki simge yapı ifadeleriyle (`q`) ikinci arama.
2. Adaylar gözle incelendi: başka yerden (aynı adlı Galler kasabası, İstanbul'daki Elmadağ vb.), müze içi, reklam/marka, olay ya da filigranlı fotoğraflar elendi. Seçimler `ilce-secilenler.json` ve `ilce-secilenler-3.json`'da (130 ilçe; kalan 12 için `ilce-ek-arama-2.json` ile üçüncü arama yapıldı). 12 ilçede uygun fotoğraf bulunamadı.
3. `ilce-indir.mjs ilce-secilenler.json`: 1920 px tam boy ve güncel atıf.
4. `donustur.py`: il kapaklarıyla aynı klasöre yazar; var olan manifest kayıtları korunur.

### Tüm ilçeler (2026-11-11)

Kalan 831 ilçe (`ilceler-tumu.json`) için aynı yöntemle ilçe başına 4 aday indirildi (`ilce-aday-indir.mjs`). 31 ilçede hiç aday çıkmadı. Adaylar gözle incelendi; 611 ilçe için seçim `ilce-secilenler-tumu.json`'da. Fotoğrafı olmayan ilçe sayfaları ilin kapak fotoğrafını gösterir (sayfa tarafında, kayıt eklenmeden). Artvin-Şavşat ve Erzurum-Narman dosyaları il kapaklarıyla aynı adı taşımasın diye `-ilce` ekiyle adlandırıldı.

Yönetimde "Hazır görselleri ekle" düğmesi bir basışta en fazla 60 sayfa işler; kalan varsa tekrar basılır.
