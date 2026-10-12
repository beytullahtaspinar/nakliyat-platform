import { Module } from '@nestjs/common';
import { ReviewsModule } from '../reviews/reviews.module.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [ReviewsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ModerationModule {}
