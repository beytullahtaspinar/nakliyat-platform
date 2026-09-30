import { Global, Module } from '@nestjs/common';
import { CompaniesService } from './companies.service.js';
import { CompanyProfileController } from './company-profile.controller.js';

@Global()
@Module({
  controllers: [CompanyProfileController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
