# Kredi sistemi

Firmalar taleplere teklif verirken kredi kullanır. Faz 1: kredi defteri, yönetim ayarları ve elle kredi işleme.
Kartla ve havale/EFT ile yükleme sonraki fazlarda (öneri: `/mnt/project-files/plan/kredi-ve-odeme-sistemi.md`).

## Kurallar

- Kredi tam sayıdır. Bakiye `CreditAccount`, her değişiklik değiştirilemez `CreditTransaction` satırıdır; ikisi aynı veritabanı işleminde yazılır. Bakiye koşullu güncellenir (`balance >= miktar`), eksiye düşmez.
- **Teklif verilirken düşer** (şehir içi / şehirler arası ayrı değer). Düşülen miktar `Quote.creditCost`'ta durur. Teklifi güncellemek ücretsizdir.
- **Geri çekilen teklif**: iade yok. **Müşteri talebi iptal ederse** ya da müşteri hesabı silinip açık talepleri iptal olursa: geri çekilmemiş tekliflere tam iade.
- **Seçim yapılmadan süresi dolan talep**: ayardaki oran kadar iade (varsayılan %0). Saatlik iş (`ExpiredRefundsService`) yalnızca son 3 günde süresi dolan talepleri tarar; oran sonradan artırılırsa eski talepler geriye dönük iade almaz.
- Teklif başına en fazla bir iade (`Quote.creditRefundedAt` + `refund:<teklifId>` benzersiz anahtar).
- **Hoş geldin kredisi**: firma ilk onaylandığında bir kez (`welcome:<firmaId>`), ayar 0 ise verilmez.
- Yönetim elle ekler/düşer; gerekçe zorunlu, firmanın hareket listesinde görünür, karar geçmişine `credit.adjust` yazılır.

## Ayarlar

`CreditSettings` tek satır (id 1). Sistem **kapalı başlar**: kapalıyken teklif ücretsizdir, defter satırı yazılmaz. Yönetim: `/yonetim/krediler/ayarlar`.

| Alan | Varsayılan | Açıklama |
|---|---|---|
| `enabled` | false | Açıkken teklif kredi düşer |
| `quoteCostLocal` / `quoteCostIntercity` | 50 / 100 | Teklif başına kredi |
| `creditValueTry` | 1 | 1 kredinin TL karşılığı (raporlar, ileride yükleme) |
| `welcomeCredits` | 0 | Onaylanan firmaya bir kez |
| `expiredRefundPercent` | 0 | Seçimsiz süresi dolan talepte iade yüzdesi |
| `lowBalanceThreshold` | 100 | Firma panelinde düşük bakiye uyarısı |

## Ekranlar

- Firma: `/firma-paneli/kredi` (menüde sistem açıksa ya da bakiye varsa görünür), teklif formunda kredi ve bakiye satırı.
- Yönetim: `/yonetim/krediler` (pano + hareketler), `/yonetim/krediler/ayarlar`, firma kaydında Kredi kartı.

## Testler

Ayar satırı ortak olduğu için testler sistemi veritabanında açmaz: API e2e `CreditsService.getSettings`'i kendi uygulamasında değiştirir, tarayıcı testi sistem kapalıyken elle kredi işler.
