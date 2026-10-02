import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { CompanyQuotesController } from './company-quotes.controller.js';
import { CustomerQuotesController } from './customer-quotes.controller.js';
import { QuotesService } from './quotes.service.js';

@Module({
  imports: [MediaModule],
  controllers: [CompanyQuotesController, CustomerQuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
