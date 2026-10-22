// cPanel "Setup Node.js App" (Phusion Passenger) giriş dosyası.
// Passenger başlangıç dosyasını require() ile yüklediği için ESM derlemesini buradan açıyoruz.
//
// Sunucuya dışarıdan SSH ile bağlanılamadığı için bekleyen veritabanı migration'ları
// uygulama açılırken burada uygulanır (DATABASE_URL, cPanel'deki ortam değişkenlerinden gelir).
// Migration'lar uygulamanın kendi mariadb sürücüsüyle uygulanır (migrate.cjs): sunucuda Prisma'nın
// migration motoru veritabanına bağlanamıyor. Migration yoksa birkaç saniyede biter.
// RUN_MIGRATIONS=false ile kapatılabilir.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

if (process.env.RUN_MIGRATIONS !== 'false') {
  // Ayrı süreçte çalışır: bağlantı ve kilit uygulama açılmadan kapanmış olur
  const result = spawnSync(process.execPath, [path.join(__dirname, 'migrate.cjs')], {
    cwd: __dirname,
    env: process.env,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (result.status !== 0) {
    console.error('Veritabanı migration başarısız, uygulama başlatılmıyor.', result.error ?? '');
    process.exit(1);
  }
}

import('./dist/main.js').catch((err) => {
  console.error(err);
  process.exit(1);
});
