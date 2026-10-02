import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { VerificationChannel } from '../generated/prisma/enums.js';
import { ConfirmCodeDto, SendEmailCodeDto, VerificationStatusDto } from './dto/verification.dto.js';
import { VerificationService } from './verification.service.js';

// Kod tahminine karşı ek katman (asıl sınır kod başına 5 deneme). Testler AUTH_RATE_LIMIT ile yükseltir.
const THROTTLE = { default: { limit: Number(process.env.AUTH_RATE_LIMIT) || 10, ttl: 60_000 } };

@ApiTags('Kimlik doğrulama')
@ApiBearerAuth()
@Controller('auth/verification')
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Get()
  @ApiOkResponse({ type: VerificationStatusDto })
  status(@CurrentUser() user: AuthUser) {
    return this.verification.status(user.id);
  }

  @Throttle(THROTTLE)
  @Post('email/send')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: VerificationStatusDto })
  sendEmail(@CurrentUser() user: AuthUser, @Body() dto: SendEmailCodeDto) {
    return this.verification.sendEmailCode(user.id, dto.email);
  }

  @Throttle(THROTTLE)
  @Post('email/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: VerificationStatusDto })
  confirmEmail(@CurrentUser() user: AuthUser, @Body() dto: ConfirmCodeDto) {
    return this.verification.confirm(user.id, VerificationChannel.EMAIL, dto.code);
  }

  @Throttle(THROTTLE)
  @Post('phone/send')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: VerificationStatusDto })
  sendPhone(@CurrentUser() user: AuthUser) {
    return this.verification.sendPhoneCode(user.id);
  }

  @Throttle(THROTTLE)
  @Post('phone/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: VerificationStatusDto })
  confirmPhone(@CurrentUser() user: AuthUser, @Body() dto: ConfirmCodeDto) {
    return this.verification.confirm(user.id, VerificationChannel.PHONE, dto.code);
  }
}
