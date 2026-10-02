import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { createOAuthProviders } from './oauth/index.js';
import { OAuthController } from './oauth/oauth.controller.js';
import { OAuthService } from './oauth/oauth.service.js';
import { OAUTH_PROVIDERS } from './oauth/provider.js';
import { VerificationModule } from '../verification/verification.module.js';

@Module({
  imports: [
    VerificationModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [AuthController, OAuthController],
  providers: [
    AuthService,
    { provide: OAUTH_PROVIDERS, useFactory: createOAuthProviders, inject: [ConfigService] },
    OAuthService,
  ],
})
export class AuthModule {}
