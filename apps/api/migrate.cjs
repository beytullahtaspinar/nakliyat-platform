// Bekleyen veritabanı migration'larını uygular (`prisma migrate deploy` yerine).
//
// Neden: 2026-10-22'de sunucudaki MariaDB 10.11.19'a güncellendikten sonra Prisma'nın migration
// motoru (schema-engine) veritabanına bağlanamaz oldu (P1001), uygulamanın kullandığı mariadb
// sürücüsü ise sorunsuz bağlanıyor. Bu betik aynı sürücüyle çalışır ve kayıtları Prisma'nın
// _prisma_migrations tablosuna Prisma'yla aynı biçimde yazar; `prisma migrate status/deploy`
// bu kayıtları kendi uyguladıkları gibi görür.
//
//   node migrate.cjs        (DATABASE_URL ortam değişkeninden okunur)
//
// app.cjs uygulama açılırken bunu çağırır. Çıkış kodu 0 değilse uygulama başlatılmaz.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// mariadb, API'nin doğrudan bağımlılığı değil; Prisma'nın MariaDB adaptörünün yanındaki kopya kullanılır
const adapterEntry = require.resolve('@prisma/adapter-mariadb');
const mariadb = require(require.resolve('mariadb', { paths: [path.dirname(adapterEntry)] }));

const MIGRATIONS_DIR = path.join(__dirname, 'prisma', 'migrations');
// Prisma da bu adla kilit alır: aynı anda başlayan iki süreç ya da prisma CLI ile çakışmaz
const LOCK_NAME = 'prisma_migrate';
const LOCK_TIMEOUT_SECONDS = 60;

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS \`_prisma_migrations\` (
  \`id\` VARCHAR(36) NOT NULL,
  \`checksum\` VARCHAR(64) NOT NULL,
  \`finished_at\` DATETIME(3) NULL,
  \`migration_name\` VARCHAR(255) NOT NULL,
  \`logs\` TEXT NULL,
  \`rolled_back_at\` DATETIME(3) NULL,
  \`started_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`applied_steps_count\` INTEGER UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

function connectionOptions(databaseUrl) {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    multipleStatements: true,
    connectTimeout: 10_000,
  };
}

/** Klasördeki migration'lar, ada göre sıralı (Prisma'nın sırası). */
function localMigrations(dir = MIGRATIONS_DIR) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'migration.sql')))
    .map((e) => e.name)
    .sort()
    .map((name) => {
      const sql = fs.readFileSync(path.join(dir, name, 'migration.sql'));
      return { name, sql: sql.toString('utf8'), checksum: crypto.createHash('sha256').update(sql).digest('hex') };
    });
}

async function migrate({ databaseUrl = process.env.DATABASE_URL, dir = MIGRATIONS_DIR, log = console.log } = {}) {
  if (!databaseUrl) throw new Error('DATABASE_URL tanımlı değil');
  const conn = await mariadb.createConnection(connectionOptions(databaseUrl));
  try {
    const [lock] = await conn.query('SELECT GET_LOCK(?, ?) AS ok', [LOCK_NAME, LOCK_TIMEOUT_SECONDS]);
    if (Number(lock.ok) !== 1) throw new Error('Migration kilidi alınamadı (başka bir süreç uyguluyor olabilir)');
    try {
      await conn.query(CREATE_TABLE);
      const rows = await conn.query(
        'SELECT migration_name, finished_at, rolled_back_at FROM `_prisma_migrations`',
      );
      const failed = rows.filter((r) => r.finished_at === null && r.rolled_back_at === null);
      if (failed.length > 0) {
        // Prisma'daki P3009 ile aynı kural: yarım kalan migration elle çözülmeden devam edilmez
        throw new Error(
          `Yarım kalmış migration var: ${failed.map((r) => r.migration_name).join(', ')}. ` +
            'Veritabanını kontrol edip kaydı düzeltmeden yeni migration uygulanmaz.',
        );
      }
      const applied = new Set(rows.filter((r) => r.finished_at !== null).map((r) => r.migration_name));
      const pending = localMigrations(dir).filter((m) => !applied.has(m.name));
      if (pending.length === 0) {
        log('Bekleyen migration yok.');
        return [];
      }
      for (const m of pending) {
        const id = crypto.randomUUID();
        await conn.query(
          'INSERT INTO `_prisma_migrations` (id, checksum, migration_name, started_at, applied_steps_count) VALUES (?, ?, ?, NOW(3), 0)',
          [id, m.checksum, m.name],
        );
        try {
          await conn.query(m.sql);
        } catch (err) {
          await conn.query('UPDATE `_prisma_migrations` SET logs = ? WHERE id = ?', [String(err.message ?? err), id]);
          throw new Error(`${m.name} uygulanamadı: ${err.message ?? err}`);
        }
        await conn.query(
          'UPDATE `_prisma_migrations` SET finished_at = NOW(3), applied_steps_count = 1 WHERE id = ?',
          [id],
        );
        log(`Uygulandı: ${m.name}`);
      }
      return pending.map((m) => m.name);
    } finally {
      await conn.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]).catch(() => {});
    }
  } finally {
    await conn.end().catch(() => {});
  }
}

module.exports = { migrate, localMigrations };

if (require.main === module) {
  migrate().then(
    () => process.exit(0),
    (err) => {
      console.error('Veritabanı migration başarısız:', err.message ?? err);
      process.exit(1);
    },
  );
}
