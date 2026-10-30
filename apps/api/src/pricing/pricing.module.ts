import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller.js';
import { PricingService } from './pricing.service.js';
import { RegionStatsService } from './region-stats.service.js';

@Module({
  controllers: [PricingController],
  providers: [PricingService, RegionStatsService],
  exports: [PricingService],
})
export class PricingModule {}
