# Kredi sistemi

Firmalar taleplere teklif verirken kredi kullanır. Faz 1: kredi defteri, yönetim ayarları ve elle kredi işleme.
Faz 2: havale/EFT ile yükleme (bildirim + yönetim onayı). Faz 3: iyzico ile kartla yükleme.

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
| `minTopupTry` | 100 | Havale bildiriminde en az tutar (TL) |
| `bankAccounts` | [] | En fazla 3 hesap `{ bank, holder, iban }`; IBAN TR + mod 97 denetimli. Boşsa havale bildirimi kapalı |
| `cardEnabled` | false | Kartla ödeme açık; iyzico anahtarları da tanımlı olmalı |

## Havale/EFT ile yükleme

- Banka hesabı tanımlanınca firmanın Kredi sayfasında hesaplar, **firmaya özel açıklama kodu** (`CreditAccount.transferCode`, ör. `EN-7KQ2MD`, ilk gösterimde üretilir) ve bildirim formu çıkar. Kredi sistemi kapalıyken de çalışır (firmalar önceden yükleyebilir).
- Firma tutarı, gönderen adını, tarihi (bugün ile 30 gün öncesi arası), gönderdiği hesabı ve isteğe bağlı dekontu (PDF/JPG/PNG/WebP, 10 MB, belge yüklemesiyle aynı akış, `firmalar/<firmaId>/`) bildirir. Aynı anda en fazla 5 bekleyen bildirim; bekleyeni geri alabilir.
- Yönetim `/yonetim/krediler/havaleler`'de (menüde sayaç) hesaba geçen tutarı düzeltip onaylar ya da gerekçeyle reddeder. Kredi = tutar ÷ **onay anındaki** kredi değeri, aşağı yuvarlanır. Onay `TRANSFER_TOPUP` defter satırı (`transfer:<bildirimId>`) ile aynı işlemde yazılır; iki yönetici aynı anda onaylasa kredi bir kez yüklenir.
- Karar geçmişi `transfer.approve` / `transfer.reject`; firmaya `CREDIT_TOPUP` bildirimi (e-posta/push/uygulama içi).

## Kartla yükleme (iyzico)

- iyzico **Checkout Form**: firma tutarı seçer (`minTopupTry` – 50.000 TL), API ödemeyi `CardPayment` (PENDING) olarak açar, iyzico'nun ödeme sayfasına yönlendirir; kart bilgisi sunucumuza hiç gelmez, 3D Secure iyzico'da. Tek çekim.
- iyzico ödeme sonrası `POST https://api.evdenevenakliyat.app/v1/payments/iyzico/callback` adresine `token` gönderir. Sunucu sonucu iyzico'dan **yeniden sorgular** (gönderilen veriye güvenmez), sepet kimliği, para birimi ve ödenen tutarı karşılaştırır; tutarsa `CARD_TOPUP` defter satırı (`card:<ödemeId>`) aynı işlemde yazılır, firmaya `CREDIT_TOPUP` bildirimi gider, firma `/firma-paneli/kredi?odeme=<id>#kart`'a döner. Aynı dönüş iki kez gelse kredi bir kez yüklenir.
- Kredi = tutar ÷ ödeme başlarken geçerli kredi değeri, aşağı yuvarlanır. Firma hesabında e-posta zorunlu (iyzico alıcı bilgisi); yönetici firma görünümündeyken ödeme başlatamaz.
- Dönüş gelmezse ya da iyzico ödemeyi incelemeye alırsa (`fraudStatus` 0) 10 dakikada bir çalışan iş bekleyen ödemeleri yeniden sorgular; 35 dakika içinde tamamlanmayan form `EXPIRED`, 24 saat sonra incelemedeki ödeme de kapanır.
- **Ortam değişkenleri** (API, yalnızca sunucuda): `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_BASE_URL` (canlı `https://api.iyzipay.com`, deneme `https://sandbox-api.iyzipay.com`). Anahtar yoksa kart seçeneği görünmez. Deneme ortamındaki ödemeler `sandbox` işaretlenir, defter notunda "(deneme)" yazar, yönetim toplamlarına katılmaz; canlıya geçmeden önce deneme kredileri elle düşülmelidir.
- İade: iyzico panelinden yapılır, ardından firmanın kredisi yönetimden elle düşülür (iade API'si yok).
- Yönetim: `/yonetim/krediler/kart-odemeleri` (son 30 gün tahsilat, durum süzgeci, arama), ayarlarda "Kartla ödeme açık (iyzico)" ve anahtar durumu.

## Ekranlar

- Firma: `/firma-paneli/kredi` (menüde sistem açıksa ya da bakiye varsa görünür), teklif formunda kredi ve bakiye satırı.
- Yönetim: `/yonetim/krediler` (pano + hareketler), `/yonetim/krediler/havaleler`, `/yonetim/krediler/kart-odemeleri`, `/yonetim/krediler/ayarlar` (banka hesapları dahil), firma kaydında Kredi kartı.

## Testler

Ayar satırı ortak olduğu için testler sistemi veritabanında açmaz: API e2e `CreditsService.getSettings`'i kendi uygulamasında değiştirir, tarayıcı testi sistem kapalıyken elle kredi işler ve havale onaylar (banka hesabı kaydı ortak ayara yazılır, teklifleri etkilemez).

Kart ödemeleri sahte iyzico sunucusuyla denenir: API e2e imzayı doğrulayan bir taklit sunucu kurar, tarayıcı testi `apps/web/e2e/iyzico-mock.mjs` (ödeme sayfası "Öde" / "Reddet") kullanır.
