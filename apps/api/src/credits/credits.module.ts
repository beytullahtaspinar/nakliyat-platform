import { Global, Module } from '@nestjs/common';
import { CompanyCreditsController } from './company-credits.controller.js';
import { CreditsService } from './credits.service.js';
import { ExpiredRefundsService } from './expired-refunds.service.js';

/** Kredi defteri: teklif, talep ve yönetim modülleri bakiyeyi yalnızca CreditsService üzerinden değiştirir */
@Global()
@Module({
  controllers: [CompanyCreditsController],
  providers: [CreditsService, ExpiredRefundsService],
  exports: [CreditsService],
})
export class CreditsModule {}
