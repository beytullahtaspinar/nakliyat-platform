import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ErrorReporterService } from '../observability/error-reporter.service.js';
import { CardPaymentsService } from './card-payments.service.js';

const CHECK_INTERVAL_MS = 10 * 60_000;

/**
 * Dönüşü gelmemiş kart ödemelerini (sekme kapandı, bağlantı koptu) iyzico'ya sorar.
 * Uygulama ayaktayken 10 dakikada bir çalışır; testler reconcile'ı kendisi çağırır.
 */
@Injectable()
export class CardPaymentsCheckService implements OnModuleInit, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly payments: CardPaymentsService,
    private readonly errors: ErrorReporterService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    const run = () => this.payments.reconcile().catch((e: unknown) => this.errors.capture(e, { tags: { job: 'card-payments-reconcile' } }));
    setTimeout(run, 120_000).unref();
    this.timer = setInterval(run, CHECK_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }
}
