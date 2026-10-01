import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { NotificationChannel } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaginationDto } from '../requests/dto/list-requests.dto.js';
import { UpdatePreferencesDto } from './dto/notifications.dto.js';
import { NOTIFICATION_TYPES, OPTIONAL_CHANNELS, typesForRole } from './notification-types.js';

const inbox = (userId: string) => ({ userId, channel: NotificationChannel.IN_APP });

@ApiTags('Bildirimler')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Uygulama içi bildirim kutusu, yeniden eskiye. */
  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() { page, limit }: PaginationDto) {
    const where = inbox(user.id);
    const [items, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, type: true, title: true, body: true, data: true, readAt: true, createdAt: true },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return { items, total, unread, page, limit };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async readAll(@CurrentUser() user: AuthUser) {
    await this.prisma.notification.updateMany({
      where: { ...inbox(user.id), readAt: null },
      data: { readAt: new Date() },
    });
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { ...inbox(user.id), id },
      data: { readAt: new Date() },
    });
    if (count === 0) throw new NotFoundException('Bildirim bulunamadı');
  }

  /** Kullanıcının rolüne uygun bildirim türleri ve her kanal için açık/kapalı durumu. */
  @Get('preferences')
  async preferences(@CurrentUser() user: AuthUser) {
    const [account, saved] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true } }),
      this.prisma.notificationPreference.findMany({ where: { userId: user.id } }),
    ]);
    const enabled = (type: string, channel: NotificationChannel) =>
      saved.find((p) => p.type === type && p.channel === channel)?.enabled ?? true;
    return {
      email: account.email,
      channels: OPTIONAL_CHANNELS,
      items: typesForRole(user.role).map((type) => ({
        type,
        label: NOTIFICATION_TYPES[type].label,
        description: NOTIFICATION_TYPES[type].description,
        channels: Object.fromEntries(OPTIONAL_CHANNELS.map((c) => [c, enabled(type, c)])),
      })),
    };
  }

  @Patch('preferences')
  async updatePreferences(@CurrentUser() user: AuthUser, @Body() dto: UpdatePreferencesDto) {
    const allowed = new Set<string>(typesForRole(user.role));
    const items = (dto.items ?? []).filter((item) => allowed.has(item.type));

    if (dto.email !== undefined) {
      const email = dto.email || null;
      if (email) {
        const taken = await this.prisma.user.findFirst({ where: { email, id: { not: user.id } }, select: { id: true } });
        if (taken) throw new ConflictException('Bu e-posta adresi başka bir hesapta kayıtlı');
      }
      await this.prisma.user.update({ where: { id: user.id }, data: { email } });
    }

    await this.prisma.$transaction(
      items.map(({ type, channel, enabled }) =>
        this.prisma.notificationPreference.upsert({
          where: { userId_type_channel: { userId: user.id, type, channel } },
          create: { userId: user.id, type, channel, enabled },
          update: { enabled },
        }),
      ),
    );
    return this.preferences(user);
  }
}
