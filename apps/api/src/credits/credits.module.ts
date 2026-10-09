import { Global, Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { CardPaymentsCheckService } from '../payments/card-payments-check.service.js';
import { CardPaymentsService } from '../payments/card-payments.service.js';
import { IyzicoClient } from '../payments/iyzico.client.js';
import { PaymentsCallbackController } from '../payments/payments-callback.controller.js';
import { BankTransfersService } from './bank-transfers.service.js';
import { CompanyCreditsController } from './company-credits.controller.js';
import { CreditsService } from './credits.service.js';
import { ExpiredRefundsService } from './expired-refunds.service.js';

/** Kredi defteri: teklif, talep ve yönetim modülleri bakiyeyi yalnızca CreditsService üzerinden değiştirir */
@Global()
@Module({
  imports: [MediaModule],
  controllers: [CompanyCreditsController, PaymentsCallbackController],
  providers: [CreditsService, BankTransfersService, ExpiredRefundsService, IyzicoClient, CardPaymentsService, CardPaymentsCheckService],
  exports: [CreditsService, BankTransfersService, CardPaymentsService],
})
export class CreditsModule {}
