import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOAuthProviders } from '../auth/oauth/index.js';
import { OAUTH_PROVIDERS } from '../auth/oauth/provider.js';
import { MediaModule } from '../media/media.module.js';
import { AccountController } from './account.controller.js';
import { AccountDeletionService } from './account-deletion.service.js';

@Module({
  imports: [MediaModule],
  controllers: [AccountController],
  // Hesap silinince Apple ile giriş yetkisini kaldırmak için sağlayıcılar (anahtarlar yalnızca okunur)
  providers: [AccountDeletionService, { provide: OAUTH_PROVIDERS, useFactory: createOAuthProviders, inject: [ConfigService] }],
  exports: [AccountDeletionService],
})
export class AccountModule {}
