import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ErrorReporterService } from '../observability/error-reporter.service.js';
import { CreditsService } from './credits.service.js';

const CHECK_INTERVAL_MS = 60 * 60_000;

/**
 * Seçim yapılmadan süresi dolan taleplerin kredi iadesi (ayardaki oran 0 ise iş yapmaz).
 * Uygulama ayaktayken saatte bir çalışır; testler refundExpired'ı kendisi çağırır.
 */
@Injectable()
export class ExpiredRefundsService implements OnModuleInit, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly credits: CreditsService,
    private readonly errors: ErrorReporterService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    const run = () => this.credits.refundExpired().catch((e: unknown) => this.errors.capture(e, { tags: { job: 'credit-expired-refunds' } }));
    setTimeout(run, 90_000).unref();
    this.timer = setInterval(run, CHECK_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }
}
