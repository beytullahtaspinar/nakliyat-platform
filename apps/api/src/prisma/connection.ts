import { PrismaMariaDb } from '@prisma/adapter-mariadb';

/**
 * Sürücünün varsayılan bağlantı kurma süresi 1 sn. Paylaşımlı sunucuda MariaDB kısa süre yoğunlaştığında bu
 * süre aşılıyor ve istek "Connection timeout: failed to create socket" ile düşüyor (Sentry NAKLIYAT-J).
 * Birkaç saniyelik bekleme bu anlık takılmaları kullanıcıya hata göstermeden atlatır.
 */
const DEFAULT_CONNECT_TIMEOUT_MS = 5000;

/**
 * DATABASE_URL'i (mysql://kullanici:sifre@sunucu:3306/veritabani) MariaDB sürücü ayarlarına çevirir.
 * Şifredeki özel karakterler URL kodlamasıyla (%40 gibi) yazılabilir.
 */
export function createMariaDbAdapter(databaseUrl: string) {
  const url = new URL(databaseUrl);
  return new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectionLimit: Number(url.searchParams.get('connection_limit') ?? 5),
    connectTimeout: Number(
      url.searchParams.get('connect_timeout_ms') ?? DEFAULT_CONNECT_TIMEOUT_MS,
    ),
  });
}
