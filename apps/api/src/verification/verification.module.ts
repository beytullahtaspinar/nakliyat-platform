import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_CODE_SENDER, PHONE_CODE_SENDER } from './senders/code-sender.js';
import { createEmailSender, createPhoneSender } from './senders/index.js';
import { VerificationController } from './verification.controller.js';
import { VerificationService } from './verification.service.js';

/**
 * E-posta ve telefon doğrulaması. Telefon sağlayıcısı (Netgsm SMS ya da WhatsApp) PHONE_OTP_PROVIDER
 * ile seçilir; tanımlı değilse telefon doğrulaması zorunlu tutulmaz. Kurulum: docs/dogrulama.md
 */
@Module({
  controllers: [VerificationController],
  providers: [
    { provide: EMAIL_CODE_SENDER, useFactory: createEmailSender, inject: [ConfigService] },
    { provide: PHONE_CODE_SENDER, useFactory: createPhoneSender, inject: [ConfigService] },
    VerificationService,
  ],
  exports: [VerificationService],
})
export class VerificationModule {}
