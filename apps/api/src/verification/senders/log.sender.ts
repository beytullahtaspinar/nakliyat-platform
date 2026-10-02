import { Logger } from '@nestjs/common';
import type { CodeRecipient, CodeSender } from './code-sender.js';

/**
 * Yerel geliştirme ve testler için: kodu göndermez, sunucu loguna yazar.
 * Canlıda (NODE_ENV=production) hiç kullanılmaz.
 */
export class LogCodeSender implements CodeSender {
  readonly provider = 'log';
  private readonly logger: Logger;

  constructor(label: string) {
    this.logger = new Logger(`LogCodeSender:${label}`);
  }

  async send(to: CodeRecipient, code: string) {
    this.logger.warn(`Doğrulama kodu (${to.address}): ${code} — gerçek gönderim yapılandırılmamış`);
  }
}
