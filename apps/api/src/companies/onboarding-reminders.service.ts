import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { DomainEvents } from '../events/domain-events.js';
import { UserRole, UserStatus } from '../generated/prisma/enums.js';
import { ErrorReporterService } from '../observability/error-reporter.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  dueOnboardingStep,
  isSendingHour,
  ONBOARDING_MAX_AGE_DAYS,
  ONBOARDING_REMINDER_DAYS,
} from './onboarding-rules.js';

const CHECK_INTERVAL_MS = 30 * 60_000;
const DAY_MS = 86_400_000;

/**
 * Firma olarak kayıt olup firma bilgilerini girmeyen hesaplara kayıttan 1 ve 3 gün sonra hatırlatma
 * olayı yayınlar (bildirimi notifications modülü gönderir). Profil oluşturulunca hatırlatma durur.
 * Uygulama ayaktayken 30 dakikada bir, yalnızca TSİ 09:00-21:00 arasında çalışır.
 */
@Injectable()
export class OnboardingRemindersService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OnboardingRemindersService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
    private readonly errors: ErrorReporterService,
  ) {}

  onModuleInit() {
    // Testler sendDue'yu sabit bir saatle kendisi çağırır
    if (process.env.NODE_ENV === 'test') return;
    const run = () => this.sendDue().catch((e: unknown) => this.errors.capture(e, { tags: { job: 'onboarding-reminders' } }));
    setTimeout(run, 90_000).unref();
    this.timer = setInterval(run, CHECK_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  /** Zamanı gelen hatırlatmaları gönderir, gönderilen hesap sayısını döner. */
  async sendDue(now = new Date()) {
    if (!isSendingHour(now)) return 0;
    const candidates = await this.prisma.user.findMany({
      where: {
        role: UserRole.COMPANY,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        company: { is: null },
        onboardingReminderStep: { lt: ONBOARDING_REMINDER_DAYS.length },
        createdAt: {
          gte: new Date(now.getTime() - ONBOARDING_MAX_AGE_DAYS * DAY_MS),
          lte: new Date(now.getTime() - ONBOARDING_REMINDER_DAYS[0] * DAY_MS),
        },
      },
      select: { id: true, createdAt: true, onboardingReminderStep: true, onboardingRemindedAt: true },
      take: 200,
    });
    let sent = 0;
    for (const user of candidates) {
      const step = dueOnboardingStep(user, now);
      if (!step) continue;
      // Satırı sahiplen: aynı anda çalışan iki süreç aynı hatırlatmayı iki kez göndermesin
      const claimed = await this.prisma.user.updateMany({
        where: { id: user.id, onboardingReminderStep: user.onboardingReminderStep },
        data: { onboardingReminderStep: step, onboardingRemindedAt: now },
      });
      if (claimed.count !== 1) continue;
      this.events.emit('company_account.reminder_due', { userId: user.id, step });
      sent++;
    }
    if (sent > 0) this.logger.log(`Firma bilgilerini girmeyen ${sent} hesaba hatırlatma gönderildi`);
    return sent;
  }
}
