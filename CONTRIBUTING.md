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
