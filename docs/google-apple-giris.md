# Google ve Apple ile giriş

Kod: `apps/api/src/auth/oauth` (API), `apps/web/src/app/api/giris` ve `apps/web/src/app/(site)/kayit/tamamla` (web).
Anahtarlar tanımlı değilse düğmeler görünmez; telefon + şifreyle giriş her zaman çalışır.

## Nasıl çalışır

1. Kişi giriş ya da kayıt sayfasında "Google ile devam et" / "Apple ile devam et"e basar.
   Sayfaya sağlayıcı scripti yüklenmez (düz bağlantı), PageSpeed etkilenmez.
2. Sağlayıcı kişiyi `https://evdenevenakliyat.app/api/giris/<google|apple>/donus` adresine geri gönderir.
   API kodu sağlayıcıda kimlik belirteciyle (id_token) değiştirir ve imzasını doğrular.
   Gizli anahtarlar yalnızca API'dedir.
3. - Bu Google/Apple hesabı daha önce bağlandıysa: oturum açılır.
   - E-posta adresi bizde **doğrulanmış** bir hesaba aitse: hesaba bağlanır, oturum açılır.
     Bizde doğrulanmamışsa bağlanmaz (adresi başkası yazmış olabilir); kişiye telefon ve şifreyle girmesi söylenir.
   - Hesap yoksa: "Kaydı tamamla" ekranında telefon numarası ve rol (taşınacağım / firmayım) sorulur.
     E-posta sağlayıcı tarafından doğrulandığı için e-posta kodu adımı atlanır.
4. Bu yolla açılan hesapların şifresi yoktur. Şifreyle girmeye çalışan kişiye düğmeyi kullanması söylenir.
   Yönetici gerekirse yönetim ekranından şifre belirleyebilir.

Güvenlik: state (CSRF) ve nonce kontrolü, Google'da PKCE, id_token imza / yayıncı / alıcı / süre doğrulaması.
Giriş sayfasındaki hata mesajları adreste kod olarak taşınır (`/giris?hata=sure`), serbest metin gösterilmez.

## Google kurulumu (ücretsiz)

1. [Google Cloud Console](https://console.cloud.google.com) → yeni proje (ör. `evdenevenakliyat`).
2. **APIs & Services → OAuth consent screen**: uygulama adı `evdenevenakliyat.app`, destek e-postası,
   logo, yetkili alan adı `evdenevenakliyat.app`, gizlilik politikası adresi. Kapsamlar: `openid`, `email`, `profile`
   (hassas kapsam olmadığı için Google incelemesi gerekmez). Yayın durumunu **In production** yap.
3. **Credentials → Create credentials → OAuth client ID** → *Web application*:
   - Authorized redirect URI: `https://evdenevenakliyat.app/api/giris/google/donus`
4. Verilen **Client ID** ve **Client secret** değerlerini API uygulamasına ekle
   (cPanel → *Setup Node.js App* → `nakliyat-api` → *Environment variables*), sonra **Restart**:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

## Apple kurulumu (Apple Developer Program gerekir, yıllık 99 USD)

1. [developer.apple.com](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles**.
2. **Identifiers → App IDs**: uygulama kimliği oluştur (ör. `app.evdenevenakliyat`), *Sign in with Apple* işaretli.
   Mobil uygulama da bu kimliği kullanacak.
3. **Identifiers → Services IDs**: yeni kimlik (ör. `app.evdenevenakliyat.giris`), *Sign in with Apple* → *Configure*:
   - Primary App ID: 2. adımdaki
   - Domains: `evdenevenakliyat.app`
   - Return URLs: `https://evdenevenakliyat.app/api/giris/apple/donus`
4. **Keys**: yeni anahtar, *Sign in with Apple* işaretli (Primary App ID seç). `.p8` dosyasını indir
   (yalnızca bir kez indirilebilir) ve **Key ID**'yi not al. **Team ID** sağ üstte görünür.
5. API ortam değişkenleri, sonra **Restart**:
   - `APPLE_CLIENT_ID` = Services ID (ör. `app.evdenevenakliyat.giris`)
   - `APPLE_TEAM_ID`
   - `APPLE_KEY_ID`
   - `APPLE_PRIVATE_KEY` = `.p8` dosyasının tüm içeriği (`-----BEGIN PRIVATE KEY-----` dahil).
     cPanel tek satır istiyorsa satır sonlarını `\n` olarak yaz; uygulama çevirir.

Apple, kişinin adını yalnızca **ilk** girişte gönderir; e-postasını gizlemeyi seçen kişi için
`...@privaterelay.appleid.com` adresi gelir. Bu adrese e-posta gönderebilmek için Apple Developer →
*Services → Sign in with Apple for Email Communication* bölümünde gönderen adresi
`bildirim@evdenevenakliyat.app` kaydedilmelidir.

## Kontrol

- Anahtarlar doğruysa `https://api.evdenevenakliyat.app/v1/auth/oauth/providers` → `{"providers":["google","apple"]}`.
- Hatalar API loguna ve Sentry'ye `provider` etiketiyle düşer (ör. `Google 400: invalid_grant`, `id_token alıcısı geçersiz`).

```sql
SELECT provider, email, createdAt FROM UserIdentity ORDER BY createdAt DESC LIMIT 20;
```

## Testler

`OAUTH_TEST_PROVIDER=1` (yalnızca geliştirme, canlıda yok sayılır) sahte bir "test" sağlayıcısı açar:
`/api/giris/test?login_hint=ornek@test.local` sağlayıcıya gitmeden aynı akışı çalıştırır. Tarayıcı testleri bunu kullanır.
