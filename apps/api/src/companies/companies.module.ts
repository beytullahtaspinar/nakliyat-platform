import { Global, Module } from '@nestjs/common';
import { CompaniesService } from './companies.service.js';
import { CompanyBadgesService } from './company-badges.service.js';
import { CompanyProfileController } from './company-profile.controller.js';

@Global()
@Module({
  controllers: [CompanyProfileController],
  providers: [CompaniesService, CompanyBadgesService],
  exports: [CompaniesService, CompanyBadgesService],
})
export class CompaniesModule {}
