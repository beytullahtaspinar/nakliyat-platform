import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import {
  createErrorReporter,
  readRelease,
  type ErrorContext,
  type ErrorReporter,
} from '@nakliyat/monitoring';
import {
  DATABASE_UNREACHABLE_FINGERPRINT,
  databaseUnreachable,
} from '../prisma/database-errors.js';

/** Uygulamanın sürüm etiketi (ör. "surum-12"). Sunucuda paketin kökündeki RELEASE dosyasından okunur. */
export const APP_RELEASE = readRelease(
  new URL('../../RELEASE', import.meta.url),
);

/**
 * Hataları JSON log olarak yazar, SENTRY_DSN tanımlıysa Sentry'ye de gönderir.
 * Ayrıntılar: packages/monitoring
 */
@Injectable()
export class ErrorReporterService implements OnApplicationShutdown {
  private readonly reporter: ErrorReporter = createErrorReporter({
    service: 'api',
    dsn: process.env.SENTRY_DSN,
    release: APP_RELEASE,
    environment: process.env.NODE_ENV ?? 'development',
  });

  capture(error: unknown, context?: ErrorContext): string {
    const db = databaseUnreachable(error);
    if (!db) return this.reporter.capture(error, context);
    // Veritabanına ulaşılamayınca her iş ve istek ayrı hata verir; hepsi tek Sentry kaydında toplanır
    // ve Prisma'nın sakladığı asıl bağlantı hatası başlığa yazılır.
    return this.reporter.capture(asDatabaseUnreachableError(error, db.cause), {
      ...context,
      tags: { ...context?.tags, database: 'erisilemiyor' },
      fingerprint: DATABASE_UNREACHABLE_FINGERPRINT,
    });
  }

  flush(timeoutMs?: number) {
    return this.reporter.flush(timeoutMs);
  }

  async onApplicationShutdown() {
    await this.reporter.flush();
  }
}

function asDatabaseUnreachableError(
  original: unknown,
  cause: string | undefined,
): Error {
  // Prisma mesajının ilk satırı hangi sorgunun düştüğünü söyler: "Invalid `prisma.x.findMany()` invocation:"
  const query = String((original as Error).message ?? '')
    .trim()
    .split('\n')[0];
  const err = new Error(
    `Veritabanına bağlanılamıyor: ${cause ?? 'sürücü sebep vermedi'}${query ? ` (${query})` : ''}`,
  );
  err.name = 'DatabaseUnreachable';
  const stack = (original as Error).stack;
  // Yığın izi asıl hatanınki kalır (hangi işte/istekte olduğu görünsün); yalnızca başlık satırı değişir.
  if (stack)
    err.stack = `${err.name}: ${err.message}\n${stack
      .split('\n')
      .filter((l) => /^\s+at /.test(l))
      .join('\n')}`;
  return err;
}
