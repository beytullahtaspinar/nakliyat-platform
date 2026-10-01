# Geliştirme Rehberi

## Dal (branch) düzeni

- `main`: Canlıdaki kod. Doğrudan push yapılmaz, yalnızca PR ile.
- `feature/<kisa-aciklama>`: Yeni özellik
- `fix/<kisa-aciklama>`: Hata düzeltmesi

## Commit mesajları

[Conventional Commits](https://www.conventionalcommits.org/tr/) kullanılır:

```
feat(api): teklif verme uç noktası
fix(web): talep formunda tarih doğrulaması
docs: cPanel kurulum adımları
```

## PR kuralları

- Her PR'da CI (lint, typecheck, test, build) yeşil olmalı.
- Veritabanı değişikliği varsa `pnpm db:migrate` ile migration üretilip PR'a eklenir. Migration dosyaları elle düzenlenmez.
- `.env` dosyaları ve şifreler asla repoya girmez; yeni değişkenler `.env.example`'a eklenir.

## Kod düzeni

- API modülleri `apps/api/src/<modul>/` altında: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, testler yanında `*.spec.ts`.
- Kod ve değişken isimleri İngilizce, kullanıcıya görünen metinler Türkçe.

## Testler

| Komut | Ne yapar | Gerekenler |
|---|---|---|
| `pnpm test` | Birim testleri (API, paketler) | — |
| `pnpm --filter @nakliyat/api test:e2e` | API'yi gerçek veritabanıyla test eder | MariaDB (`docker compose up -d`) |
| `pnpm --filter @nakliyat/web test:e2e` | Tarayıcıda uçtan uca akışlar (Playwright), mobil ve masaüstü; her sayfada erişilebilirlik (axe) ve konsol hatası kontrolü | MariaDB + `pnpm build`; ilk seferde `pnpm --filter @nakliyat/web exec playwright install chromium` |
| `pnpm --filter @nakliyat/web lighthouse` | PageSpeed ölçümü: erişilebilirlik, en iyi uygulamalar ve SEO 100, performans en az 95 olmalı | `pnpm build` |

CI her PR'da Lighthouse dışındakilerin hepsini çalıştırır; biri kırmızıysa PR birleştirilmez (birleşen her şey otomatik canlıya gider). Lighthouse ayda bir otomatik çalışır (`.github/workflows/lighthouse.yml`); tasarımı veya sayfa yapısını belirgin değiştiren bir PR'dan sonra Actions sekmesinden elle çalıştırılır.

Kurallar:

- Düzeltilen her hata için önce o hatayı yakalayan bir test yazılır, sonra düzeltilir. Aynı hata ikinci kez canlıya çıkamaz.
- Yeni bir sayfa eklenince `apps/web/e2e/` içinde en az açılış + erişilebilirlik testi, herkese açık bir sayfaysa `apps/web/lighthouserc.cjs` listesine de eklenir.
- Hata ayıklama ve log arama: [docs/izleme.md](docs/izleme.md).
