# Taşınma sonrası: hatırlatma, otomatik tamamlama ve itiraz

Anlaşılan iş (`Booking`) taşınma günü geldiğinde müşteri ya da firma tarafından tamamlandı olarak
işaretlenir (`POST /bookings/:id/complete`, bkz. [degerlendirmeler.md](degerlendirmeler.md)). Kimse
işaretlemezse iş sonsuza kadar "planlandı" kalmasın diye:

| Ne zaman (Türkiye saati) | Ne olur |
| --- | --- |
| Taşınmadan 1 gün önce, 10:00 sonrası | `MOVE_REMINDER` hatırlatması (bookings/move-reminders.service.ts) |
| Taşınma günü | İş tamamlanabilir, iptal edilebilir ya da "taşınma yapılmadı" diye itiraz edilebilir |
| Ertesi gün, 10:00 sonrası | İki tarafa `BOOKING_FOLLOW_UP` "Taşınma tamamlandı mı?" bildirimi (iş başına bir kez, `completionCheckSentAt`) |
| Taşınmadan 7 gün sonra, 10:00 sonrası | İtiraz yoksa iş kendiliğinden tamamlanır (`completedBy = SYSTEM`); müşteriye `REVIEW_REQUEST`, firmaya bilgi |

Gün sayısı `AUTO_COMPLETE_DAYS` (apps/api/src/reviews/review-rules.ts). İş
`reviews/booking-follow-up.service.ts` içinde 15 dakikada bir çalışır (testte kapalı; testler `run()`'ı
sabit saatle çağırır). Otomatik tamamlama da elle tamamlama gibi talebi `COMPLETED` yapar ve firmanın
`completedJobs` sayısını artırır. Firma kredisi etkilenmez (kredi teklif verirken düşer).

## İtiraz

- `POST /bookings/:id/dispute` `{ reason: 5-500 karakter }`: müşteri ya da firma, taşınma günü geldikten
  sonra ve iş tamamlanmadan "taşınma yapılmadı" der. Karşı tarafa bildirim gider, `AuditLog`
  `booking.dispute`.
- İtirazlı iş kendiliğinden tamamlanmaz; taraflar tamamlayamaz, iptal edemez, yeniden itiraz edemez.
  Müşteri değerlendirme yazamaz.
- Yönetim `/yonetim/itirazlar` ekranında (menü ve pano sayacı) iki tarafla görüşüp karar verir:
  `POST /admin/bookings/:id/resolve-dispute` `{ decision: complete | cancel, note }`.
  - `complete`: iş tamamlanır (`completedBy = ADMIN`), müşteri firmayı değerlendirebilir.
  - `cancel`: iş ve talep iptal olur. Firmanın kredisi kendiliğinden iade edilmez; gerekirse yönetici
    Krediler ekranından düzeltme yapar.
  - Açıklama (`disputeResolution`) iki tarafa bildirilir ve iş sayfalarında görünür. `AuditLog`
    `booking.dispute_resolve`.
- Tamamlanmış işe itiraz yok; sorun varsa destek@ adresine yazılır.

## Ekranlar

- Müşteri `/hesabim/talepler/[id]`, firma `/firma-paneli/isler/[id]` (web ve mobil): "Taşınma yapılmadı"
  düğmesi, kendiliğinden tamamlanma tarihi, bekleyen itiraz ve yönetim kararı.
- API alanları: `canDispute`, `autoCompleteOn`, `completedBy`, `disputedAt`, `disputedBy`, `disputeReason`,
  `disputeResolvedAt`, `disputeResolution`.
