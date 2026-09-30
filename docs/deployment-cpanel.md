# cPanel'e Kurulum

Canlı ortam cPanel üzerinde iki Node.js uygulaması olarak çalışır:

| Uygulama | Alan adı (örnek) | Başlangıç dosyası |
|---|---|---|
| API | `api.evdenevenakliyat.app` | `app.cjs` |
| Web | `evdenevenakliyat.app` | `apps/web/server.js` |

Tanıtım sayfaları, şehir bazlı SEO sayfaları ve müşteri, firma, admin panelleri aynı Next.js uygulamasında, ana alan adında çalışır. Blog isteğe bağlı olarak WordPress ile `blog.evdenevenakliyat.app` adresinde tutulabilir.

> **.app uzantısı hakkında:** .app alan adları tarayıcılarda yalnızca HTTPS ile açılır (HSTS preload). Ana alan adı ve her alt alan adı için SSL sertifikası (cPanel AutoSSL veya Let's Encrypt) site yayına girmeden önce aktif olmalı. Sertifika yoksa site hiç açılmaz.

## 1. Hosting'de önce kontrol edilecekler

- [ ] cPanel'de **Setup Node.js App** menüsü var mı? Node.js **22** (en az 20.9) seçilebiliyor mu?
- [ ] **PostgreSQL Databases** menüsü var mı? Yoksa hosting firmasından açılmasını iste. Açılamıyorsa MySQL'e geçebiliriz (Prisma'da tek satır), ama `String[]` alanları için şemada küçük değişiklik gerekir.
- [ ] **SSH Access** açık mı? Otomatik deploy için gerekli.
- [ ] Disk ve inode kotası: API paketi bağımlılıklarıyla birlikte ~380 MB tutuyor.

## 2. İlk kurulum (bir kez)

1. **Alan adları:** Ana alan adı web uygulamasına, `api.` alt alan adı API'ye ayrılır. Ana alan adında WordPress varsa önce yedekle ve blog'a taşı. Her iki adres için SSL'i (AutoSSL / Let's Encrypt) aç.
2. **Veritabanı:** PostgreSQL veritabanı ve kullanıcısı oluştur, kullanıcıya tüm yetkileri ver.
3. **API uygulaması** (Setup Node.js App → Create Application):
   - Node.js version: 22
   - Application mode: Production
   - Application root: `nakliyat-api`
   - Application URL: `api.evdenevenakliyat.app`
   - Application startup file: `app.cjs`
   - Environment variables: `NODE_ENV=production`, `DATABASE_URL`, `WEB_URL=https://evdenevenakliyat.app`, `JWT_ACCESS_SECRET` (uzun ve rastgele bir değer)
4. **Web uygulaması**:
   - Application root: `nakliyat-web`
   - Application URL: `evdenevenakliyat.app`
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
| Variable | `NEXT_PUBLIC_API_URL` | `https://api.evdenevenakliyat.app` |

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
