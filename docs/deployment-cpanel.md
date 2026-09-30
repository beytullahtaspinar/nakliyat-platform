# cPanel'e Kurulum

Canlı ortam cPanel üzerinde iki Node.js uygulaması olarak çalışır:

| Uygulama | Alan adı (örnek) | Başlangıç dosyası |
|---|---|---|
| API | `api.alanadi.com` | `app.cjs` |
| Web | `app.alanadi.com` | `apps/web/server.js` |

WordPress tanıtım sitesi ana alan adında (`alanadi.com`) olduğu gibi kalır.

## 1. Hosting'de önce kontrol edilecekler

- [ ] cPanel'de **Setup Node.js App** menüsü var mı? Node.js **22** (en az 20.9) seçilebiliyor mu?
- [ ] **PostgreSQL Databases** menüsü var mı? Yoksa hosting firmasından açılmasını iste. Açılamıyorsa MySQL'e geçebiliriz (Prisma'da tek satır), ama `String[]` alanları için şemada küçük değişiklik gerekir.
- [ ] **SSH Access** açık mı? Otomatik deploy için gerekli.
- [ ] Disk ve inode kotası: API paketi bağımlılıklarıyla birlikte ~380 MB tutuyor.

## 2. İlk kurulum (bir kez)

1. **Alt alan adları:** `api.` ve `app.` alt alan adlarını oluştur, SSL'i (AutoSSL / Let's Encrypt) aç.
2. **Veritabanı:** PostgreSQL veritabanı ve kullanıcısı oluştur, kullanıcıya tüm yetkileri ver.
3. **API uygulaması** (Setup Node.js App → Create Application):
   - Node.js version: 22
   - Application mode: Production
   - Application root: `nakliyat-api`
   - Application URL: `api.alanadi.com`
   - Application startup file: `app.cjs`
   - Environment variables: `NODE_ENV=production`, `DATABASE_URL`, `WEB_URL=https://app.alanadi.com`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
4. **Web uygulaması**:
   - Application root: `nakliyat-web`
   - Application URL: `app.alanadi.com`
   - Application startup file: `apps/web/server.js`
   - Environment variables: `NODE_ENV=production`
5. **SSH anahtarı:** cPanel → SSH Access → Manage SSH Keys ile bir anahtar oluştur/ekle ve yetkilendir. Özel anahtarı GitHub'a secret olarak gir.

## 3. GitHub ayarları

Repo → Settings → Environments → `production`:

| Tür | Ad | Örnek |
|---|---|---|
| Secret | `CPANEL_SSH_HOST` | `sunucu.hosting.com` |
| Secret | `CPANEL_SSH_PORT` | `22` (bazı firmalarda farklıdır) |
| Secret | `CPANEL_SSH_USER` | cPanel kullanıcı adı |
| Secret | `CPANEL_SSH_KEY` | Özel SSH anahtarı |
| Variable | `CPANEL_API_DIR` | `nakliyat-api` |
| Variable | `CPANEL_WEB_DIR` | `nakliyat-web` |
| Variable | `NEXT_PUBLIC_API_URL` | `https://api.alanadi.com` |

## 4. Deploy

GitHub → Actions → **cPanel'e deploy** → Run workflow.

İş akışı şunları yapar: paketleri derler (`scripts/package-release.sh`), rsync ile sunucuya yükler, `prisma migrate deploy` çalıştırır, `tmp/restart.txt` ile uygulamaları yeniden başlatır ve `/v1/health` adresini kontrol eder.

> Not: `node_modules` klasörleri CloudLinux Node.js Selector'ın beklediği `~/nodevenv/<uygulama>/22/lib/node_modules` yoluna yüklenir. Hosting'in bu yapıyı kullanmıyorsa ilk deploy'da bu yolu birlikte ayarlarız.

## 5. Elle deploy (SSH yoksa)

```bash
./scripts/package-release.sh
```

`out/api` ve `out/web` klasörlerini (node_modules hariç) File Manager ile uygulama klasörlerine yükle, `node_modules` içeriğini yukarıdaki sanal ortam yoluna koy, ardından Setup Node.js App ekranından **Restart** et.

## Yerelde Docker

`docker-compose.yml` sadece yerel geliştirme veritabanı içindir. cPanel paylaşımlı hostingde Docker çalışmaz. İleride VPS'e geçilirse aynı paketler Docker imajına dönüştürülebilir.
