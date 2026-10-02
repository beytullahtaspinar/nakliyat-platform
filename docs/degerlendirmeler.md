# Değerlendirmeler (puan ve yorum)

Müşteri, platform üzerinden anlaştığı ve taşınması tamamlanan firmayı 1-5 yıldızla puanlar, isteğe
bağlı yorum yazar. Puanlar ve yorumlar firmanın herkese açık sayfasında (`/firmalar/<ad>-<kimlik>`)
ve teklif kartlarında görünür.

## Akış

1. **İş tamamlanır.** Taşınma günü geldiğinde (Türkiye saatiyle) müşteri "Taşınma tamamlandı" ya da
   firma "İş tamamlandı" der: `POST /bookings/:id/complete`. Gün gelmeden yapılamaz; böylece
   taşınmadan önce yorum yazılamaz. İş ve talep `COMPLETED` olur, firmanın `completedJobs` sayısı artar.
   Firma tamamladıysa müşteriye `REVIEW_REQUEST` bildirimi (e-posta + uygulama içi) gider.
2. **Müşteri değerlendirir.** `POST /bookings/:id/review` → `{ rating: 1-5, comment?: 10-2000 karakter }`.
   İş başına bir değerlendirme, sonradan değiştirilemez. Firmaya `NEW_REVIEW` bildirimi gider.
3. **Firma yanıtlar.** `POST /company/reviews/:id/reply` bir kez; yanıt yorumun altında herkese açık.
4. **Yönetici denetler.** Yorumlar onaysız yayımlanır. Hakaret, kişisel veri, reklam gibi kurallara
   aykırı yorumu yönetici gerekçeyle gizler (`/yonetim/degerlendirmeler`). Gizli yorum firma sayfasından
   ve ortalamadan çıkar; firma ve müşteri gerekçeyi kendi panelinde görür. Karar `AuditLog`'a yazılır.

## Puan hesabı

`Company.ratingAverage` ve `ratingCount` her yorum, gizleme ve yeniden yayında yalnızca **yayındaki**
yorumlardan yeniden hesaplanır. Uydurma ya da tohum puan yok; yorumu olmayan firma "Henüz yorum yok" gösterir.

## Kişisel veri

- Herkese açık sayfada müşteri adı kısaltılır ("Ayşe Yılmaz" → "Ayşe Y."), güzergâh yalnızca il adı.
- Firma kendi panelinde müşterinin tam adını görür (iş kaydından zaten tanıyor).
- Müşteri hesabı silinince yorum metni silinir, puan ortalamada kalır, ad "Müşteri" görünür.

## SEO

- Firma sayfası `MovingCompany` yapısal verisi taşır; `aggregateRating` ve `review` yalnızca yayındaki
  gerçek yorumlardan, sayfada görünen yorumlarla aynı. Yorumlar üçüncü taraf (müşteri) yorumu olduğu için
  Google'ın "kendi kendine yorum" kuralına takılmaz.
- Yorumu olmayan firma sayfası `noindex, follow` (ince içerik). Yorumu olanlar site haritasında.
- Sayfa bir saat önbellekte kalır; yorum eklenince/yanıtlanınca/gizlenince sunucu eylemi `updateTag("firmalar")`
  ile önbelleği hemen bitirir.
- Sayfada yorumların nasıl toplandığı açıklanır (yalnızca tamamlanan taşımalar, iş başına bir yorum):
  Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği'nin tüketici yorumları için istediği şeffaflık.
