import { PrismaMariaDb } from '@prisma/adapter-mariadb';

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
  });
}
