# Veritabanı Yedeği

Yedekleri `scripts/db-backup.sh` alır. Deploy her yeni sürümle bu betiği sunucuda `~/db-backup.sh` olarak günceller.

| Ne zaman | Dosya |
|---|---|
| Her gece (cron) | `~/yedekler/veritabani/<veritabani>-YYYYAAGG-SSDDss.sql.gz` |
| Her kurulumdan önce (deploy.sh) | `...-oncesi-surum-N.sql.gz` |
| Geri yüklemeden önce | `...-geri-yukleme-oncesi.sql.gz` |

14 günden eski yedekler silinir; en yeni 5 yedeğe hiçbir zaman dokunulmaz. Yedek, döküm sonuna kadar yazılmadıysa "başarılı" sayılmaz ve dosya silinir. Yedek klasörü `public_html` dışında olduğu için web'den erişilemez.

## Kurulum (bir kez, cPanel Terminal)

1. Veritabanı bağlantı bilgisini, yalnızca senin okuyabileceğin bir dosyaya yaz. Değer, API uygulamasındaki `DATABASE_URL` ile aynıdır (cPanel → Setup Node.js App → nakliyat-api → Environment variables). Şifre ekrana yazılmaz:

   ```bash
   mkdir -p ~/.config/nakliyat && chmod 700 ~/.config/nakliyat
   read -rs -p "DATABASE_URL: " U && printf 'DATABASE_URL=%s\n' "$U" > ~/.config/nakliyat/db.env && chmod 600 ~/.config/nakliyat/db.env && unset U && echo
   ```

2. Betik henüz sunucuda yoksa (ilk deploy'dan önce) indir ve dene:

   ```bash
   curl -fsSL -H "Authorization: Bearer $(cat ~/.config/nakliyat/github-token)" \
     -H "Accept: application/vnd.github.raw" \
     https://api.github.com/repos/beytullahtaspinar/nakliyat-platform/contents/scripts/db-backup.sh \
     -o ~/db-backup.sh && chmod +x ~/db-backup.sh
   ~/db-backup.sh
   ```

   Çıktıda `Yedek alındı: ...` görmelisin.

3. cPanel → **Cron Jobs** → her gece 03:30 (`30 3 * * *`), komut:

   ```bash
   /bin/bash $HOME/db-backup.sh >> $HOME/yedek.log 2>&1
   ```

## Sunucu dışında kopya

Yedekler sunucuyla aynı diskte; sunucu tamamen kaybolursa onlar da gider. Şimdilik:

- cPanel'in kendi hesap yedeği (Veridyen) ikinci katman olarak durur.
- Haftada bir, cPanel → File Manager ile `yedekler/veritabani` içindeki en yeni dosyayı bilgisayarına indir.

Dosya depolama (Cloudflare R2) kurulduğunda bu kopya otomatik hale getirilecek.

## Geri yükleme

```bash
~/db-restore.sh                       # yedekleri listeler
~/db-restore.sh ~/yedekler/veritabani/<dosya>.sql.gz
```

Betik `EVET` yazmanı ister, önce o anki durumun yedeğini alır, sonra seçilen yedeği yükler. Ardından API'yi yeniden başlat: `touch ~/nakliyat-api/tmp/restart.txt`.

Bozuk bir sürüm veritabanını da bozduysa sıra: önce `~/deploy.sh --rollback`, sonra `...-oncesi-surum-N.sql.gz` yedeğiyle geri yükleme.

**Geri yüklemeyi ayda bir dene** (yerelde ya da ayrı bir test veritabanında). Hiç denenmemiş yedek, yedek sayılmaz.
