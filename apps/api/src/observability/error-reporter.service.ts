import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import {
  createErrorReporter,
  readRelease,
  type ErrorContext,
  type ErrorReporter,
} from '@nakliyat/monitoring';

/** Uygulamanın sürüm etiketi (ör. "surum-12"). Sunucuda paketin kökündeki RELEASE dosyasından okunur. */
export const APP_RELEASE = readRelease(new URL('../../RELEASE', import.meta.url));

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
    return this.reporter.capture(error, context);
  }

  flush(timeoutMs?: number) {
    return this.reporter.flush(timeoutMs);
  }

  async onApplicationShutdown() {
    await this.reporter.flush();
  }
}
