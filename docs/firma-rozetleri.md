# Firma rozetleri

Müşterinin teklifleri karşılaştırırken firmaya güvenmesini kolaylaştıran üç rozet. Rozetler veritabanında
saklanmaz; her istekte güncel veriden hesaplanır, koşul sağlanmazsa kendiliğinden kalkar.

| Rozet | Koşul |
| --- | --- |
| Belgeleri onaylı | Firma doğrulanmış; K3 yetki belgesi, vergi levhası ve ticaret sicil kaydı onaylı; K3 süresi geçerli |
| Hızlı yanıt | Son 90 günde en az 5 teklif; talebin yayına girmesinden teklife kadar geçen ortanca süre ≤ 3 saat |
| Yüksek puanlı | Yayındaki en az 5 yorumda ortalama ≥ 4,5 |

- Kurallar: `apps/api/src/companies/badge-rules.ts`, hesaplama: `company-badges.service.ts`.
- Yanıt süresi `MovingRequest.publishedAt` alanından ölçülür (taslak talep doğrulama bitince yayına girer).
- Görünür olduğu yerler: müşterinin teklif listesi (`GET /requests/:id/quotes` → `company.badges`),
  herkese açık firma sayfası (`GET /companies/:id` → `badges`), firma paneli (`GET /company/profile/badges`,
  başlıkta kazanılanlar, Değerlendirmeler sayfasında ilerleme).
- Belge rozeti olan firmada ayrıca "Doğrulanmış firma" etiketi gösterilmez (rozet doğrulamayı kapsar).
- Metinler: `apps/web/src/lib/badges.ts`; eşik değişirse ikisi birlikte güncellenmeli.
