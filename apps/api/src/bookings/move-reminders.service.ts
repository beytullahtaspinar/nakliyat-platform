import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { DomainEvents } from '../events/domain-events.js';
import { BookingStatus } from '../generated/prisma/enums.js';
import { ErrorReporterService } from '../observability/error-reporter.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { addDays, dayStart, reminderDay } from './calendar-rules.js';

const CHECK_INTERVAL_MS = 15 * 60_000;

/**
 * Taşınma günü yarın olan planlanmış işler için hatırlatma olayı yayınlar (bildirimi
 * notifications modülü gönderir). Her iş için bir kez: reminderSentAt dolu olan atlanır.
 * Uygulama ayaktayken 15 dakikada bir çalışır; UptimeRobot /v1/health'i yokladığı için süreç uyumaz.
 */
@Injectable()
export class MoveRemindersService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(MoveRemindersService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
    private readonly errors: ErrorReporterService,
  ) {}

  onModuleInit() {
    // Testler sendDue'yu sabit bir saatle kendisi çağırır
    if (process.env.NODE_ENV === 'test') return;
    const run = () => this.sendDue().catch((e: unknown) => this.errors.capture(e, { tags: { job: 'move-reminders' } }));
    // Açılıştan kısa süre sonra bir kez (yeniden başlatma bir turu kaçırmasın), sonra düzenli aralıkla
    setTimeout(run, 60_000).unref();
    this.timer = setInterval(run, CHECK_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  /** Zamanı gelen hatırlatmaları gönderir, gönderilen iş sayısını döner. */
  async sendDue(now = new Date()) {
    const day = reminderDay(now);
    if (!day) return 0;
    const due = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.SCHEDULED,
        reminderSentAt: null,
        scheduledAt: { gte: dayStart(day), lt: dayStart(addDays(day, 1)) },
      },
      select: { id: true },
      take: 500,
    });
    let sent = 0;
    for (const { id } of due) {
      // Satırı sahiplen: aynı anda çalışan iki süreç aynı hatırlatmayı iki kez göndermesin
      const claimed = await this.prisma.booking.updateMany({
        where: { id, reminderSentAt: null, status: BookingStatus.SCHEDULED },
        data: { reminderSentAt: now },
      });
      if (claimed.count !== 1) continue;
      this.events.emit('booking.move_day_approaching', { bookingId: id });
      sent++;
    }
    if (sent > 0) this.logger.log(`${day} tarihli ${sent} taşıma için hatırlatma gönderildi`);
    return sent;
  }
}
