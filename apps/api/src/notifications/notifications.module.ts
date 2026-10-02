import { Module } from '@nestjs/common';
import { BrevoEmailChannel } from './channels/brevo-email.channel.js';
import { NOTIFICATION_CHANNELS, type ChannelProvider } from './channels/channel.js';
import { WebPushChannel } from './channels/web-push.channel.js';
import { NotificationsController } from './notifications.controller.js';
import { PushController } from './push.controller.js';
import { NotificationsListener } from './notifications.listener.js';
import { NotificationsService } from './notifications.service.js';

/**
 * Bildirimler: iş olaylarını (bkz. events/domain-events.ts) dinler, uygulama içi kayıt
 * oluşturur ve açık kanallardan (e-posta, anlık bildirim) gönderir. SMS eklemek için ChannelProvider
 * uygulayan bir sınıf yazıp aşağıdaki listeye eklemek yeterli.
 */
@Module({
  controllers: [NotificationsController, PushController],
  providers: [
    BrevoEmailChannel,
    WebPushChannel,
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (email: BrevoEmailChannel, push: WebPushChannel): ChannelProvider[] => [email, push],
      inject: [BrevoEmailChannel, WebPushChannel],
    },
    NotificationsService,
    NotificationsListener,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
