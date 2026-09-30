// cPanel "Setup Node.js App" (Phusion Passenger) giriş dosyası.
// Passenger başlangıç dosyasını require() ile yüklediği için ESM derlemesini buradan açıyoruz.
//
// Sunucuya dışarıdan SSH ile bağlanılamadığı için bekleyen veritabanı migration'ları
// uygulama açılırken burada uygulanır (DATABASE_URL, cPanel'deki ortam değişkenlerinden gelir).
// Migration yoksa birkaç saniyede biter. RUN_MIGRATIONS=false ile kapatılabilir.
const { spawnSync } = require('node:child_process');

if (process.env.RUN_MIGRATIONS !== 'false') {
  const prismaCli = require.resolve('prisma/build/index.js');
  const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
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
