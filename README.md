# evdenevenakliyat.app

Evden eve taşınacak müşterileri doğrulanmış nakliyat firmalarıyla buluşturan pazaryeri.

**Temel akış:** Taşıma talebi → Firma teklifleri → Karşılaştırma → Seçim → Değerlendirme

## Yapı

```
apps/
  api/   NestJS + Prisma + PostgreSQL (REST API, /v1)
  web/   Next.js + Tailwind (müşteri, firma ve admin arayüzü)
docs/    Mimari, veritabanı, kurulum ve cPanel dokümanları
```

Tanıtım sitesi ve blog ayrı olarak WordPress üzerinde çalışır.

## Hızlı başlangıç

Gerekenler: Node.js 22, pnpm 10, Docker (yerel veritabanı için).

```bash
pnpm install
docker compose up -d                 # yerel PostgreSQL
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
- [Veritabanı modeli](docs/veritabani.md)
- [cPanel'e kurulum](docs/deployment-cpanel.md)
