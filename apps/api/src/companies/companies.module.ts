import { Global, Module } from '@nestjs/common';
import { CompaniesService } from './companies.service.js';
import { CompanyBadgesService } from './company-badges.service.js';
import { CompanyNameChangesService } from './company-name-changes.service.js';
import { CompanyProfileController } from './company-profile.controller.js';
import { OnboardingRemindersService } from './onboarding-reminders.service.js';

@Global()
@Module({
  controllers: [CompanyProfileController],
  providers: [CompaniesService, CompanyBadgesService, CompanyNameChangesService, OnboardingRemindersService],
  exports: [CompaniesService, CompanyBadgesService, CompanyNameChangesService, OnboardingRemindersService],
})
export class CompaniesModule {}
