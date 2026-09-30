# evdenevenakliyat.app

Evden eve taşınacak müşterileri doğrulanmış nakliyat firmalarıyla buluşturan pazaryeri.

**Temel akış:** Taşıma talebi → Firma teklifleri → Karşılaştırma → Seçim → Değerlendirme

## Yapı

```
apps/
  api/   NestJS + Prisma + MariaDB/MySQL (REST API, /v1)
  web/   Next.js + Tailwind (tanıtım + müşteri, firma ve admin panelleri)
docs/    Mimari, veritabanı, kurulum ve cPanel dokümanları
```

Tanıtım sayfaları ve tüm paneller tek Next.js uygulamasındadır. Blog yazıları `cms.` alt alan adındaki WordPress'ten girilir, `/blog` altında Next.js ile yayınlanır.

## Hızlı başlangıç

Gerekenler: Node.js 22, pnpm 10, Docker (yerel veritabanı için).

```bash
pnpm install
docker compose up -d                 # yerel MariaDB 10.6
cp apps/api/.env.example apps/api/.env
pnpm db:migrate                      # tabloları oluşturur
pnpm dev                             # web: http://localhost:3000  api: http://localhost:4000/v1/health
```

## Komutlar

| Komut | Açıklama |
|---|---|
| `pnpm dev` | Tüm uygulamaları geliştirme modunda başlatır |
| `pnpm build` | Üretim derlemesi |
| `pnpm lint` | Kod stili kontrolü |
| `pnpm typecheck` | TypeScript kontrolü |
| `pnpm test` | Birim testleri |
| `pnpm db:migrate` | Yeni migration oluşturur ve uygular |

## Dokümanlar

- [Geliştirme rehberi](CONTRIBUTING.md)
- [API tasarımı](docs/api.md) (canlı Swagger: `http://localhost:4000/docs`)
- [SEO ve GEO rehberi](docs/seo-geo.md)
- [Veritabanı modeli](docs/veritabani.md)
- [cPanel'e kurulum](docs/deployment-cpanel.md)
