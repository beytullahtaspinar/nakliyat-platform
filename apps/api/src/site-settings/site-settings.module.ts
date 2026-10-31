import { Module } from '@nestjs/common';
import { AdminSiteSettingsController, SiteSettingsController } from './site-settings.controller.js';
import { SiteSettingsService } from './site-settings.service.js';

@Module({
  controllers: [SiteSettingsController, AdminSiteSettingsController],
  providers: [SiteSettingsService],
})
export class SiteSettingsModule {}
