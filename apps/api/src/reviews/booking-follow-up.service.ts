import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { DomainEvents } from '../events/domain-events.js';
import type { Prisma } from '../generated/prisma/client.js';
import { BookingActor, BookingStatus } from '../generated/prisma/enums.js';
import { ErrorReporterService } from '../observability/error-reporter.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { followUpWindow } from './review-rules.js';
import { ReviewsService } from './reviews.service.js';

const CHECK_INTERVAL_MS = 15 * 60_000;
const BATCH = 500;
const dayStart = (day: string) => new Date(`${day}T00:00:00.000Z`);

/**
 * Taşınma günü geçen ama kimsenin tamamlamadığı işler (docs/tasinma-sonrasi.md):
 * - taşınmanın ertesi günü iki tarafa "taşınma tamamlandı mı?" bildirimi (iş başına bir kez),
 * - taşınma gününden AUTO_COMPLETE_DAYS gün sonra, itiraz yoksa iş kendiliğinden tamamlanır ve müşteriden değerlendirme istenir.
 * İtirazlı işlere dokunulmaz; yönetici karar verir. 15 dakikada bir, 10:00 TSİ'den sonra çalışır.
 */
@Injectable()
export class BookingFollowUpService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(BookingFollowUpService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
    private readonly reviews: ReviewsService,
    private readonly errors: ErrorReporterService,
  ) {}

  onModuleInit() {
    // Testler run'ı sabit bir saatle kendisi çağırır
    if (process.env.NODE_ENV === 'test') return;
    const run = () => this.run().catch((e: unknown) => this.errors.capture(e, { tags: { job: 'booking-follow-up' } }));
    setTimeout(run, 90_000).unref();
    this.timer = setInterval(run, CHECK_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  /** `scope` yalnızca testler içindir: paralel çalışan test dosyaları birbirinin işine dokunmasın */
  async run(now = new Date(), scope: Prisma.BookingWhereInput = {}) {
    const window = followUpWindow(now);
    if (!window) return { checks: 0, completed: 0 };
    const completed = await this.autoComplete(window.completeBefore, scope);
    const checks = await this.sendChecks(window.checkFrom, window.checkTo, now, scope);
    if (checks || completed) this.logger.log(`Taşınma sonrası: ${checks} soru gönderildi, ${completed} iş kendiliğinden tamamlandı`);
    return { checks, completed };
  }

  /** Taşınma günü [from, to) aralığında olan, sorusu gitmemiş işlere "taşınma tamamlandı mı?" */
  private async sendChecks(from: string, to: string, now: Date, scope: Prisma.BookingWhereInput) {
    const due = await this.prisma.booking.findMany({
      where: {
        ...scope,
        status: BookingStatus.SCHEDULED,
        disputedAt: null,
        completionCheckSentAt: null,
        scheduledAt: { gte: dayStart(from), lt: dayStart(to) },
      },
      select: { id: true },
      take: BATCH,
    });
    let sent = 0;
    for (const { id } of due) {
      // Satırı sahiplen: aynı anda çalışan iki süreç aynı bildirimi iki kez göndermesin
      const claimed = await this.prisma.booking.updateMany({
        where: { id, completionCheckSentAt: null, status: BookingStatus.SCHEDULED, disputedAt: null },
        data: { completionCheckSentAt: now },
      });
      if (claimed.count !== 1) continue;
      this.events.emit('booking.completion_check', { bookingId: id });
      sent++;
    }
    return sent;
  }

  /** Taşınma günü `before` gününden önce olan, itirazsız işleri tamamlar */
  private async autoComplete(before: string, scope: Prisma.BookingWhereInput) {
    const due = await this.prisma.booking.findMany({
      where: { ...scope, status: BookingStatus.SCHEDULED, disputedAt: null, scheduledAt: { lt: dayStart(before) } },
      select: { id: true, requestId: true, companyId: true },
      orderBy: { scheduledAt: 'asc' },
      take: BATCH,
    });
    let completed = 0;
    for (const booking of due) {
      if (await this.reviews.finishBooking(booking, BookingActor.SYSTEM)) completed++;
    }
    return completed;
  }
}
