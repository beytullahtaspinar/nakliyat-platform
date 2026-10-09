import { BadRequestException, Body, Controller, Delete, ForbiddenException, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isExpoPushToken, MAX_MOBILE_DEVICES } from './channels/expo-push.js';
import { endpointHash, isPushEndpoint, MAX_DEVICES, WebPushChannel } from './channels/web-push.channel.js';
import { MobileDeviceDto, MobileDeviceTokenDto, PushEndpointDto, PushSubscriptionDto } from './dto/notifications.dto.js';

/**
 * Bu cihazda anlık bildirimi açma/kapama. Tarayıcı aboneliği web uygulamasından (subscriptions),
 * mobil uygulamanın Expo adresi firma/müşteri uygulamasından (devices) gelir.
 */
@ApiTags('Bildirimler')
@ApiBearerAuth()
@Controller('notifications/push')
export class PushController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: WebPushChannel,
  ) {}

  /** Cihazı kaydeder. Aynı cihaz daha önce başka hesapla kaydedildiyse artık bu hesaba bildirim gider. */
  @Post('subscriptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async subscribe(@CurrentUser() user: AuthUser, @Body() dto: PushSubscriptionDto, @Headers('user-agent') userAgent?: string) {
    // Yönetici firma panelini görüntülerken kendi cihazını firmanın bildirimlerine abone etmesin
    if (user.impersonatorId) throw new ForbiddenException('Yönetici görünümündeyken bu cihaz için bildirim açılamaz');
    if (!this.push.publicKey) throw new BadRequestException('Anlık bildirimler şu an kullanılamıyor');
    if (!isPushEndpoint(dto.endpoint)) throw new BadRequestException('Bu tarayıcının bildirim servisi desteklenmiyor');

    const hash = endpointHash(dto.endpoint);
    const data = {
      userId: user.id,
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      userAgent: userAgent?.slice(0, 255) ?? null,
    };
    await this.prisma.pushSubscription.upsert({ where: { endpointHash: hash }, create: { ...data, endpointHash: hash }, update: data });

    // Eski telefonlar birikmesin: en yeni MAX_DEVICES cihaz kalır
    const stale = await this.prisma.pushSubscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      skip: MAX_DEVICES,
      select: { id: true },
    });
    if (stale.length) await this.prisma.pushSubscription.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }

  @Delete('subscriptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribe(@CurrentUser() user: AuthUser, @Body() dto: PushEndpointDto) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId: user.id, endpointHash: endpointHash(dto.endpoint) } });
  }

  /** Mobil uygulama girişten sonra telefonun bildirim adresini kaydeder. */
  @Post('devices')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registerDevice(@CurrentUser() user: AuthUser, @Body() dto: MobileDeviceDto) {
    if (user.impersonatorId) throw new ForbiddenException('Yönetici görünümündeyken bu cihaz için bildirim açılamaz');
    if (!isExpoPushToken(dto.token)) throw new BadRequestException('Geçersiz bildirim adresi');

    const data = { userId: user.id, platform: dto.platform };
    await this.prisma.mobilePushToken.upsert({ where: { token: dto.token }, create: { ...data, token: dto.token }, update: data });

    const stale = await this.prisma.mobilePushToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      skip: MAX_MOBILE_DEVICES,
      select: { id: true },
    });
    if (stale.length) await this.prisma.mobilePushToken.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }

  /** Mobil uygulamadan çıkış yapılırken: bu telefona artık bu hesabın bildirimi gitmesin. */
  @Delete('devices')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unregisterDevice(@CurrentUser() user: AuthUser, @Body() dto: MobileDeviceTokenDto) {
    await this.prisma.mobilePushToken.deleteMany({ where: { userId: user.id, token: dto.token } });
  }

  /** Kullanıcı ayarlardan "deneme bildirimi gönder" dediğinde: tüm cihazlarına kısa bir bildirim. */
  @Post('test')
  async test(@CurrentUser() user: AuthUser) {
    if (user.impersonatorId) throw new ForbiddenException('Yönetici görünümündeyken deneme bildirimi gönderilemez');
    const result = await this.push
      .sendToUser(user.id, {
        title: 'Bildirimler açık',
        body: 'Yeni talep, teklif ve mesajları bu cihazda anında göreceksin.',
        path: '/uygulama',
        tag: 'TEST',
      })
      .catch(() => ({ status: 'FAILED' as const }));
    return { sent: result.status === 'SENT' };
  }
}
