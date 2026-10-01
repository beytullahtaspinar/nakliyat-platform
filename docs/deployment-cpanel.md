# cPanel'e Kurulum

Canlı ortam cPanel üzerinde iki Node.js uygulaması olarak çalışır:

| Uygulama | Alan adı (örnek) | Başlangıç dosyası |
|---|---|---|
| API | `api.evdenevenakliyat.app` | `app.cjs` |
| Web | `evdenevenakliyat.app` | `apps/web/server.js` |

Tanıtım sayfaları, şehir bazlı SEO sayfaları ve müşteri, firma, admin panelleri aynı Next.js uygulamasında, ana alan adında çalışır. Blog `evdenevenakliyat.app/blog` altında yayınlanır. Yazılar `cms.evdenevenakliyat.app` adresindeki WordPress'ten girilir ve Next.js tarafından çekilir. Ayrıntılar: [SEO ve GEO rehberi](seo-geo.md).

> **.app uzantısı hakkında:** .app alan adları tarayıcılarda yalnızca HTTPS ile açılır (HSTS preload). Ana alan adı ve her alt alan adı için SSL sertifikası (cPanel AutoSSL veya Let's Encrypt) site yayına girmeden önce aktif olmalı. Sertifika yoksa site hiç açılmaz.

## 1. Sunucu (Veridyen jsJunior paketi)

- [x] **Setup Node.js App** var, Node.js **22** seçilebiliyor.
- [x] Veritabanı **MariaDB 10.11**. Uygulama MariaDB/MySQL ile çalışır.
- [x] cPanel **Terminal** ve **Cron Jobs** var. Dışarıdan SSH **kapalı** (hosting izin vermiyor), bu yüzden deploy "çekme" yöntemiyle çalışır.
- Disk: 2 GB. API paketi bağımlılıklarıyla ~430 MB, web ~70 MB. Kurulum sırasında geçici olarak bunun iki katı yer gerekir.

## 2. Deploy nasıl çalışır?

1. `main` dalına her birleştirmede GitHub Actions **Canlı sürüm paketi** iş akışı çalışır: API ve web paketlerini derler (`scripts/package-release.sh`) ve `release.tar.gz` dosyasını GitHub Release olarak yayınlar (`surum-N`). Son 3 sürüm tutulur.
2. Sunucuda cron ile birkaç dakikada bir çalışan `~/deploy.sh` (`scripts/server-deploy.sh`) yeni sürüm varsa indirir, `node_modules` klasörlerini CloudLinux sanal ortamına (`~/nodevenv/<uygulama>/22/lib/node_modules`) taşır, uygulama dosyalarını yeniler ve `tmp/restart.txt` ile uygulamaları yeniden başlatır.
3. API açılırken bekleyen veritabanı migration'larını kendisi uygular (`app.cjs`). Veritabanı bağlantısı cPanel'deki ortam değişkenlerinden gelir; ayrı bir yere kopyalanmaz.

Kurulum logu: `~/deploy.log`. Kurulu sürüm: `~/.config/nakliyat/current-release`.

## 3. İlk kurulum (bir kez)

1. **Alan adları:** Ana alan adı web uygulamasına, `api.` alt alan adı API'ye ayrılır. Tüm adresler için SSL'i (AutoSSL / Let's Encrypt) aç. Blog editörü WordPress (`cms.`) eski PHP paketinde kalır, DNS ile yönlendirilir.
2. **Veritabanı:** cPanel → **Database Wizard** ile veritabanı ve kullanıcı oluştur, kullanıcıya **ALL PRIVILEGES** ver. Şifreyi sembolsüz üret (yalnızca harf ve rakam), böylece bağlantı adresinde kodlama gerekmez.
3. **API uygulaması** (Setup Node.js App → Create Application):
   - Node.js version: 22, Application mode: Production
   - Application root: `nakliyat-api`, Application URL: `api.evdenevenakliyat.app`
   - Application startup file: `app.cjs`
   - Environment variables: `NODE_ENV=production`, `WEB_URL=https://evdenevenakliyat.app`, `DATABASE_URL=mysql://KULLANICI:SIFRE@localhost:3306/VERITABANI`, `JWT_ACCESS_SECRET` (uzun, rastgele), isteğe bağlı `SENTRY_DSN` ([izleme.md](izleme.md))
   - **Run NPM Install**'a basma; bağımlılıkları deploy getirir.
4. **Web uygulaması:** Application root `nakliyat-web`, Application URL `evdenevenakliyat.app`, startup file `apps/web/server.js`, `NODE_ENV=production`, isteğe bağlı `SENTRY_DSN`.
5. **GitHub:** Repo → Settings → Environments → `production` → Variable `NEXT_PUBLIC_API_URL` = `https://api.evdenevenakliyat.app`.
6. **Sunucunun GitHub'a erişimi:** GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate new token. Repository access: yalnızca `nakliyat-platform`. Permissions: **Contents: Read-only**. Token'ı cPanel → **Terminal**'de şu komutla kaydet (ekrana yazılmaz, sohbete veya dosyaya yapıştırma):

   ```bash
   mkdir -p ~/.config/nakliyat && chmod 700 ~/.config/nakliyat
   read -rs -p "Token: " T && printf '%s' "$T" > ~/.config/nakliyat/github-token && chmod 600 ~/.config/nakliyat/github-token && unset T && echo
   ```

   Kontrol: `wc -c < ~/.config/nakliyat/github-token` 90 civarı, `head -c 11 ~/.config/nakliyat/github-token` ise `github_pat_` göstermeli. Web Terminal yapıştırmada görünmez karakter eklerse şu komut temizler: `sed -i 's/\x1b\[20[01]~//g; s/[[:space:]]//g' ~/.config/nakliyat/github-token`

7. **Betiği indir ve ilk kurulumu yap** (Terminal):

   ```bash
   curl -fsSL -H "Authorization: Bearer $(cat ~/.config/nakliyat/github-token)" \
     -H "Accept: application/vnd.github.raw" \
     https://api.github.com/repos/beytullahtaspinar/nakliyat-platform/contents/scripts/server-deploy.sh \
     -o ~/deploy.sh && chmod +x ~/deploy.sh
   ~/deploy.sh 2>&1 | tee -a ~/deploy.log
   ```

8. **Otomatik güncelleme:** cPanel → **Cron Jobs** → her 5 dakika (`*/5 * * * *`), komut:

   ```bash
   /bin/bash $HOME/deploy.sh >> $HOME/deploy.log 2>&1
   ```

9. **Veritabanı yedeği:** [yedekleme.md](yedekleme.md). Ayarlandıktan sonra her kurulumdan önce otomatik yedek de alınır.

## 4. Kurulumun güvenlik ağı

Her kurulumda `deploy.sh` şunları yapar:

1. Veritabanının yedeğini alır (`~/yedekler/veritabani/...-oncesi-surum-N.sql.gz`). Yedek alınamazsa kurulum yapılmaz.
2. Yeni sürümü kurar ve uygulamaları yeniden başlatır.
3. **Sağlık kontrolü:** `https://api.evdenevenakliyat.app/v1/health` ve `https://evdenevenakliyat.app/api/saglik` adreslerinin `"status":"ok"` ve yeni sürüm etiketini döndürmesini bekler (6 deneme × 10 sn).
4. Kontrol başarısızsa **otomatik olarak önceki sürüme döner** ve bozuk sürümü atlanacaklar listesine yazar (`~/.config/nakliyat/skip-release`). Bir sonraki düzeltme `main`'e birleşince o yeni sürüm normal şekilde kurulur.

Veritabanı migration'ları geri alınmaz. Bu yüzden şema değişiklikleri **genişlet → taşı → daralt** sırasıyla yapılır (önce kolon eklenir, kod ikisiyle de çalışır, eski kolon sonraki bir sürümde silinir); böylece önceki sürüm yeni şemayla da çalışır. Gerekirse yedekten dönülür.

Log dosyaları da her çalışmada kısaltılır: `~/deploy.log` ve `~/yedek.log` 5 MB'ı, uygulama logları 20 MB'ı geçerse son kısmı tutulur.

## 5. Günlük kullanım

- Yeni sürüm: PR'ı `main`'e birleştir. Birkaç dakika içinde canlıya çıkar.
- Kurulu sürüm: `cat ~/.config/nakliyat/current-release` ya da tarayıcıda `/v1/health`.
- **Bir önceki sürüme dön:** Terminal'de `~/deploy.sh --rollback 2>&1 | tee -a ~/deploy.log`. Dönülen sürüm, yeni bir sürüm çıkana kadar tekrar kurulmaz.
- Aynı sürümü yeniden kur (atlananlar listesini de temizler): Terminal'de `~/deploy.sh --force`.
- GitHub'a erişilemezse: Release sayfasından `release.tar.gz`'yi indir, File Manager ile ana klasöre yükle, Terminal'de `~/deploy.sh --from-file ~/release.tar.gz`.
- Token'ın süresi dolarsa yenisini oluşturup 6. adımdaki komutla tekrar kaydet.

## Yerelde Docker

`docker-compose.yml` sadece yerel geliştirme veritabanı içindir. cPanel paylaşımlı hostingde Docker çalışmaz. İleride VPS'e geçilirse aynı paketler Docker imajına dönüştürülebilir.
