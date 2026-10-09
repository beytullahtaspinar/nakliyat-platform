import { Global, Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { BankTransfersService } from './bank-transfers.service.js';
import { CompanyCreditsController } from './company-credits.controller.js';
import { CreditsService } from './credits.service.js';
import { ExpiredRefundsService } from './expired-refunds.service.js';

/** Kredi defteri: teklif, talep ve yönetim modülleri bakiyeyi yalnızca CreditsService üzerinden değiştirir */
@Global()
@Module({
  imports: [MediaModule],
  controllers: [CompanyCreditsController],
  providers: [CreditsService, BankTransfersService, ExpiredRefundsService],
  exports: [CreditsService, BankTransfersService],
})
export class CreditsModule {}
