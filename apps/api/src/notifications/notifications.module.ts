import { Module } from '@nestjs/common';
import { BrevoEmailChannel } from './channels/brevo-email.channel.js';
import { NOTIFICATION_CHANNELS, type ChannelProvider } from './channels/channel.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsListener } from './notifications.listener.js';
import { NotificationsService } from './notifications.service.js';

/**
 * Bildirimler: iş olaylarını (bkz. events/domain-events.ts) dinler, uygulama içi kayıt
 * oluşturur ve açık kanallardan gönderir. SMS veya push eklemek için ChannelProvider
 * uygulayan bir sınıf yazıp aşağıdaki listeye eklemek yeterli.
 */
@Module({
  controllers: [NotificationsController],
  providers: [
    BrevoEmailChannel,
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (email: BrevoEmailChannel): ChannelProvider[] => [email],
      inject: [BrevoEmailChannel],
    },
    NotificationsService,
    NotificationsListener,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
