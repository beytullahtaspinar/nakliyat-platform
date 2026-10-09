# Mobil uygulamalar

Tek Expo kod tabanından iki uygulama çıkar:

| Uygulama | Kimin için | Paket kimliği | Simge |
| --- | --- | --- | --- |
| **Evdenevenakliyat Firma** | Nakliyat firmaları (COMPANY) | `app.evdenevenakliyat.firma` | turuncu zemin |
| **Evdenevenakliyat** | Taşınacak kişiler (CUSTOMER) | `app.evdenevenakliyat.musteri` | gece mavisi zemin |

Hangisinin derleneceğini `APP_VARIANT` (`firma` / `musteri`) belirler (`app.config.ts`).
Giriş ikisinde de aynı (telefon + şifre, `POST /v1/auth/login`); hesabın rolü uygulamaya
uymuyorsa oturum açılmaz ve doğru uygulama söylenir. Yönetici hesabı mobilde açılmaz.

API istemcisi ortak pakette: `packages/api-client` (oturum yenileme, Türkçe hata mesajları,
tipler). Oturum anahtarları cihazın güvenli deposunda (Keychain / Keystore) tutulur.

## Telefonda denemek (Expo Go)

1. Telefona **Expo Go** uygulamasını kur (App Store / Google Play).
2. Bilgisayarda depo kökünde `pnpm install`.
3. `pnpm --filter @nakliyat/mobile start:firma` (ya da `start:musteri`).
4. Çıkan QR kodu telefonla okut. Uygulama canlı API'ye (`api.evdenevenakliyat.app`) bağlanır.

Yerel API ile denemek için: `EXPO_PUBLIC_API_URL=http://<bilgisayarın-yerel-ip>:4000 pnpm --filter @nakliyat/mobile start:firma`

İki uygulama arasında geçerken komut önbelleği temizler (`--clear`); aksi halde önceki uygulamanın
adı ve rengi kalabilir.

## Mağaza derlemesi (EAS)

Derleme ve mağazaya gönderme Expo'nun bulut hizmetiyle (EAS) yapılır; Mac ya da Android Studio
gerekmez. `eas.json` profilleri:

- `firma-deneme`, `musteri-deneme`: kendi telefonuna kurulacak deneme sürümü (Android'de APK)
- `firma`, `musteri`: mağaza sürümü

Gerekenler (hesap sahibi tarafından açılır, anahtarlar depoya ve sohbete yazılmaz):
Expo hesabı, Apple Developer Program, Google Play Console. Her uygulama için `eas init`
sonrası verilen proje kimliği `app.config.ts` içindeki `easProjectId` alanına yazılır.

```bash
cd apps/mobile
APP_VARIANT=firma npx eas-cli@latest build --profile firma-deneme --platform android
```

## Kontroller

`pnpm --filter @nakliyat/mobile lint` ve `typecheck` CI'da diğer paketlerle birlikte çalışır.
