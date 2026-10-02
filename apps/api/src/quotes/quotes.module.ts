import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { VerificationModule } from '../verification/verification.module.js';
import { CompanyQuotesController } from './company-quotes.controller.js';
import { CustomerQuotesController } from './customer-quotes.controller.js';
import { QuotesService } from './quotes.service.js';

@Module({
  imports: [MediaModule, VerificationModule],
  controllers: [CompanyQuotesController, CustomerQuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
