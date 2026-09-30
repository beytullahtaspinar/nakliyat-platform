import { Module } from '@nestjs/common';
import { CompanyQuotesController } from './company-quotes.controller.js';
import { CustomerQuotesController } from './customer-quotes.controller.js';
import { QuotesService } from './quotes.service.js';

@Module({
  controllers: [CompanyQuotesController, CustomerQuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
