import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { createMariaDbAdapter } from './connection.js';

/** MariaDB kilitlenme (deadlock) ya da yazma çakışmasında işlem tamamen geri alınır; bu kadar kez yeniden denenir. */
const TRANSACTION_ATTEMPTS = 3;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    super({ adapter: createMariaDbAdapter(config.getOrThrow<string>('DATABASE_URL')) });
  }

  /**
   * Aynı anda yazan istekler (ör. teklif kabulü ile başka bir talebe teklif) InnoDB'de birbirini kilitleyebilir;
   * veritabanı işlemlerden birini geri alır ve Prisma P2034 verir. Kullanıcıya 500 göstermek yerine işlem
   * baştan yeniden çalıştırılır.
   */
  override $transaction: PrismaClient['$transaction'] = ((...args: unknown[]) => {
    const run = () => (super.$transaction as (...a: unknown[]) => Promise<unknown>).apply(this, args);
    // Dizi biçimindeki sorgular bir kez çalışan sözlerdir; yeniden denenemez. Yalnızca işlev biçimi yeniden çalışır.
    return typeof args[0] === 'function' ? this.retryOnConflict(run) : run();
  }) as PrismaClient['$transaction'];

  private async retryOnConflict<T>(run: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await run();
      } catch (err) {
        if ((err as { code?: unknown }).code !== 'P2034' || attempt >= TRANSACTION_ATTEMPTS) throw err;
        this.logger.warn(`Veritabanı işlemi çakıştı, yeniden deneniyor (${attempt}/${TRANSACTION_ATTEMPTS - 1})`);
        await new Promise((resolve) => setTimeout(resolve, 20 * attempt + Math.random() * 30));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
