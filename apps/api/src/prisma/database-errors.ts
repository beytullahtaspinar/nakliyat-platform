/** Sentry'de veritabanına ulaşılamayan tüm hataların toplandığı tek kayıt */
export const DATABASE_UNREACHABLE_FINGERPRINT = ['veritabani-erisilemiyor'];

/** MariaDB sürücüsünün havuz hata kodları (mariadb/lib/misc/errors.js) */
const ER_GET_CONNECTION_TIMEOUT = 45028;
const ER_POOL_NOT_INITIALIZED = 45060;
const ER_POOL_NO_CONNECTION = 45061;

type DriverCause = { code?: unknown; message?: unknown; cause?: unknown };

export type DatabaseUnreachable = {
  /** Sürücünün asıl bağlantı hatası (ör. "Access denied for user ...", "connect ECONNREFUSED ..."); bilinmiyorsa undefined */
  cause?: string;
};

/**
 * Hata, veritabanına hiç bağlanılamadığı için mi oluştu?
 *
 * Prisma bu durumda yalnızca "pool timeout ... (pool connections: active=0 idle=0 ...)" yazar; sürücünün
 * asıl bağlantı hatası (şifre yanlış, sunucu kapalı, bağlantı sınırı dolu) mesajda yoktur, yalnızca
 * `meta.driverAdapterError.cause.cause` içinde durur. Bu işlev onu çıkarır.
 *
 * Havuzda açık bağlantı varken gelen zaman aşımı (active>0) bağlantı sorunu değil, havuzun dolmasıdır;
 * o ayrı bir hata olarak kalır.
 */
export function databaseUnreachable(
  error: unknown,
): DatabaseUnreachable | null {
  if (!error || typeof error !== 'object') return null;
  const { code, meta } = error as {
    code?: unknown;
    meta?: { driverAdapterError?: { cause?: DriverCause } };
  };
  if (code === 'P1001') return { cause: undefined };

  const driver = meta?.driverAdapterError?.cause;
  if (!driver) return null;
  const driverCode = Number(driver.code);
  const message = typeof driver.message === 'string' ? driver.message : '';
  const unreachable =
    driverCode === ER_POOL_NOT_INITIALIZED ||
    driverCode === ER_POOL_NO_CONNECTION ||
    (driverCode === ER_GET_CONNECTION_TIMEOUT && /active=0\b/.test(message));
  if (!unreachable) return null;
  const cause =
    typeof driver.cause === 'string' && driver.cause !== 'N/A'
      ? driver.cause.trim()
      : '';
  return { cause: cause || undefined };
}
