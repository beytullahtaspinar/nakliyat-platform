import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { MessagesService } from './messages.service.js';

@ApiTags('Mesajlar')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER, UserRole.COMPANY)
@Controller()
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  /** İşin konuşması (en yeni 200 mesaj, eskiden yeniye). Karşı tarafın mesajları okundu sayılır. */
  @Get('bookings/:id/messages')
  list(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.messages.list(user, id);
  }

  /** Karşı tarafa mesaj gönderir; karşı taraf okunmamış ilk mesajda e-postayla haberdar edilir. */
  @Throttle({ default: { limit: Number(process.env.MESSAGE_RATE_LIMIT) || 20, ttl: 60_000 } })
  @Post('bookings/:id/messages')
  send(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.messages.send(user, id, dto.body);
  }

  /** Okunmamış mesaj sayıları: toplam ve iş başına */
  @Get('messages/unread')
  unread(@CurrentUser() user: AuthUser) {
    return this.messages.unread(user);
  }
}
