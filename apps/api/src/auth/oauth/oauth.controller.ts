import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator.js';
import { AuthResponseDto } from '../dto/auth-response.dto.js';
import { OAuthCallbackDto, OAuthCompleteDto, OAuthStartDto, SignupTokenDto } from './oauth.dto.js';
import { OAuthService } from './oauth.service.js';

const THROTTLE = { default: { limit: Number(process.env.AUTH_RATE_LIMIT) || 20, ttl: 60_000 } };

/** Google / Apple ile giriş ve kayıt. Web akışı: apps/web/src/app/api/giris. Kurulum: docs/google-apple-giris.md */
@ApiTags('Kimlik doğrulama')
@Public()
@Controller('auth/oauth')
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}

  @Get('providers')
  providers() {
    return { providers: this.oauth.enabledProviders() };
  }

  @Throttle(THROTTLE)
  @Post(':provider/start')
  @HttpCode(HttpStatus.OK)
  start(@Param('provider') provider: string, @Body() dto: OAuthStartDto) {
    return this.oauth.start(provider, dto);
  }

  @Throttle(THROTTLE)
  @Post(':provider/callback')
  @HttpCode(HttpStatus.OK)
  callback(@Param('provider') provider: string, @Body() dto: OAuthCallbackDto) {
    return this.oauth.callback(provider, dto);
  }

  @Throttle(THROTTLE)
  @Post('pending')
  @HttpCode(HttpStatus.OK)
  pending(@Body() dto: SignupTokenDto) {
    return this.oauth.pending(dto.signupToken);
  }

  @Throttle(THROTTLE)
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  complete(@Body() dto: OAuthCompleteDto) {
    return this.oauth.complete(dto);
  }
}
