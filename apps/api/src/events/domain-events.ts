import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { ErrorReporterService } from '../observability/error-reporter.service.js';

/**
 * Modüller arası olaylar. Bir modül iş yaptıktan sonra olayı yayınlar; yan işler
 * (bildirim, ileride istatistik, arama dizini...) olayı dinler. Böylece teklif modülü
 * bildirimlerin varlığından habersizdir ve bildirim hatası asıl işlemi bozmaz.
 *
 * Olay adları geçmiş zamanlıdır ve yükte yalnızca kimlikler taşınır: dinleyen taraf
 * güncel veriyi kendisi okur.
 */
export interface DomainEventMap {
  /** Müşteri yeni bir taşıma talebi oluşturdu */
  'request.created': { requestId: string };
  /** Firma bir talebe teklif verdi */
  'quote.created': { quoteId: string };
  /** Müşteri teklifi kabul etti, iş oluştu */
  'quote.accepted': { quoteId: string; bookingId: string };
  /** Yönetici firmayı onayladı veya reddetti */
  'company.verification_changed': { companyId: string };
  /** Yönetici firmanın görünen ad değişikliğini onayladı veya reddetti */
  'company.name_change_reviewed': { changeId: string };
  /** Müşteri veya firma işin konuşmasına mesaj yazdı */
  'message.sent': { messageId: string };
  /** İşin taşınma günü yarın (Türkiye saatiyle); hatırlatma zamanı geldi */
  'booking.move_day_approaching': { bookingId: string };
  /** Müşteri ya da firma işi tamamlandı olarak işaretledi */
  'booking.completed': { bookingId: string; completedBy: 'CUSTOMER' | 'COMPANY' };
  /** Müşteri ya da firma anlaşılan işi iptal etti */
  'booking.cancelled': { bookingId: string; cancelledBy: 'CUSTOMER' | 'COMPANY' };
  /** Yönetici firmanın havale bildirimini onayladı veya reddetti */
  'credit.transfer_reviewed': { transferId: string };
  /** Firmanın kartla ödemesi başarılı oldu, kredi yüklendi */
  'credit.card_paid': { paymentId: string };
  /** Müşteri tamamlanan işin firmasını değerlendirdi */
  'review.created': { reviewId: string };
}

export type DomainEventName = keyof DomainEventMap;
type Handler<K extends DomainEventName> = (payload: DomainEventMap[K]) => Promise<void> | void;

@Injectable()
export class DomainEvents {
  private readonly logger = new Logger(DomainEvents.name);
  private readonly handlers = new Map<DomainEventName, Handler<DomainEventName>[]>();
  private readonly pending = new Set<Promise<void>>();

  constructor(private readonly errors: ErrorReporterService) {}

  on<K extends DomainEventName>(event: K, handler: Handler<K>) {
    const list = this.handlers.get(event) ?? [];
    list.push(handler as Handler<DomainEventName>);
    this.handlers.set(event, list);
  }

  /**
   * Olayı yayınlar ve beklemeden döner. Dinleyiciler arka planda çalışır;
   * hataları loglanır ve Sentry'ye gider, yayınlayan isteği etkilemez.
   */
  emit<K extends DomainEventName>(event: K, payload: DomainEventMap[K]) {
    for (const handler of this.handlers.get(event) ?? []) {
      const run = Promise.resolve()
        .then(() => handler(payload))
        .catch((error: unknown) => {
          this.logger.error(`"${event}" dinleyicisi hata verdi`);
          this.errors.capture(error, { tags: { event } });
        })
        .finally(() => this.pending.delete(run));
      this.pending.add(run);
    }
  }

  /** Bekleyen tüm dinleyiciler bitene kadar bekler (testler ve kapanış için). */
  async drain() {
    while (this.pending.size > 0) await Promise.all(this.pending);
  }
}

@Global()
@Module({ providers: [DomainEvents], exports: [DomainEvents] })
export class EventsModule {}
