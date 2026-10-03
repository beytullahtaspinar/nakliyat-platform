import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import type { Notification, Prisma } from '../generated/prisma/client.js';
import { NotificationChannel, NotificationStatus, UserStatus } from '../generated/prisma/enums.js';
import { ErrorReporterService } from '../observability/error-reporter.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NOTIFICATION_CHANNELS, type ChannelProvider, type Recipient } from './channels/channel.js';
import type { NotificationContent } from './templates.js';

const MAX_ATTEMPTS = 3;
const RETRY_INTERVAL_MS = 5 * 60_000;
/** Bu kadar süredir PENDING kalan gönderim yarıda kalmış sayılır (süreç yeniden başladı vb.) */
const STALE_PENDING_MS = 10 * 60_000;
/** Bundan eski bildirimler artık yeniden denenmez: bayat bildirim göndermektense hiç gönderme */
const RETRY_WINDOW_MS = 24 * 60 * 60_000;

/** Bildirim satırında saklanan ek alanlar: gönderim yeniden denenirken içerik buradan kurulur. */
type StoredData = Pick<NotificationContent, 'path' | 'actionLabel' | 'details'>;

/**
 * Bildirimleri kaydeder ve kanallara dağıtır.
 * Her bildirim için bir uygulama içi (IN_APP) kayıt ve kullanıcının açık tuttuğu her dış kanal
 * (e-posta, anlık bildirim) için bir gönderim kaydı oluşur. Başarısız gönderimler birkaç kez yeniden denenir.
 */
@Injectable()
export class NotificationsService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(NotificationsService.name);
  private retryTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly errors: ErrorReporterService,
    @Inject(NOTIFICATION_CHANNELS) private readonly channels: ChannelProvider[],
  ) {}

  onModuleInit() {
    this.retryTimer = setInterval(() => {
      this.retryFailed().catch((e: unknown) => this.errors.capture(e, { tags: { job: 'notification-retry' } }));
    }, RETRY_INTERVAL_MS);
    this.retryTimer.unref();
  }

  onApplicationShutdown() {
    clearInterval(this.retryTimer);
  }

  async notify(userId: string, content: NotificationContent) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, fullName: true, email: true, phone: true, status: true, deletedAt: true },
    });
    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) return;

    const disabled = await this.prisma.notificationPreference.findMany({
      where: { userId, type: content.type, enabled: false },
      select: { channel: true },
    });
    const off = new Set(disabled.map((p) => p.channel));
    const data: StoredData = { path: content.path, actionLabel: content.actionLabel, details: content.details };
    const base = { userId, type: content.type, title: content.title, body: content.body, data: data as Prisma.InputJsonObject };

    // Uygulama içi bildirim her zaman kaydedilir: kullanıcı hesabına girdiğinde görür.
    await this.prisma.notification.create({
      data: { ...base, channel: NotificationChannel.IN_APP, status: NotificationStatus.SENT, sentAt: new Date() },
    });

    const recipient: Recipient = { userId: user.id, role: user.role, fullName: user.fullName, email: user.email, phone: user.phone };
    for (const provider of this.channels) {
      if (off.has(provider.channel)) continue;
      if (provider.isAvailable && !(await provider.isAvailable(recipient))) continue;
      const row = await this.prisma.notification.create({ data: { ...base, channel: provider.channel } });
      await this.deliver(row, provider, recipient);
    }
  }

  /** Aynı içeriği birden çok kullanıcıya gönderir; birinin hatası diğerlerini durdurmaz. */
  async notifyMany(userIds: string[], content: NotificationContent) {
    for (const userId of new Set(userIds)) {
      try {
        await this.notify(userId, content);
      } catch (e) {
        this.errors.capture(e, { tags: { notification: content.type } });
      }
    }
  }

  /** Başarısız veya yarıda kalmış dış kanal gönderimlerini yeniden dener. */
  async retryFailed() {
    const now = Date.now();
    const rows = await this.prisma.notification.findMany({
      where: {
        channel: { not: NotificationChannel.IN_APP },
        attempts: { lt: MAX_ATTEMPTS },
        createdAt: { gt: new Date(now - RETRY_WINDOW_MS) },
        OR: [
          { status: NotificationStatus.FAILED },
          { status: NotificationStatus.PENDING, createdAt: { lt: new Date(now - STALE_PENDING_MS) } },
        ],
      },
      include: { user: { select: { role: true, fullName: true, email: true, phone: true } } },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    for (const { user, ...row } of rows) {
      const provider = this.channels.find((c) => c.channel === row.channel);
      if (!provider) continue;
      await this.deliver(row, provider, { userId: row.userId, ...user });
    }
    return rows.length;
  }

  private async deliver(row: Notification, provider: ChannelProvider, recipient: Recipient) {
    // Satırı sahiplen: aynı anda çalışan iki süreç (ör. iki Passenger örneği) aynı e-postayı iki kez göndermesin.
    const claimed = await this.prisma.notification.updateMany({
      where: { id: row.id, status: row.status, attempts: row.attempts },
      data: { status: NotificationStatus.PENDING, attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) return;

    const stored = (row.data ?? {}) as unknown as StoredData;
    const content: NotificationContent = {
      type: row.type as NotificationContent['type'],
      title: row.title,
      body: row.body,
      ...stored,
    };
    try {
      const result = await provider.send(recipient, content);
      await this.prisma.notification.update({
        where: { id: row.id },
        data:
          result.status === 'SENT'
            ? { status: NotificationStatus.SENT, sentAt: new Date(), lastError: null }
            : { status: NotificationStatus.SKIPPED, lastError: result.reason.slice(0, 500) },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn(`${row.channel} bildirimi gönderilemedi (deneme ${row.attempts + 1}/${MAX_ATTEMPTS}): ${message}`);
      await this.prisma.notification.update({
        where: { id: row.id },
        data: { status: NotificationStatus.FAILED, lastError: message.slice(0, 500) },
      });
      if (row.attempts + 1 >= MAX_ATTEMPTS) {
        this.errors.capture(e, { tags: { channel: row.channel, notification: row.type } });
      }
    }
  }
}
