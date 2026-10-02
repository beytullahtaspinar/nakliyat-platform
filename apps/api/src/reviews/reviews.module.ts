import { Module } from '@nestjs/common';
import { PublicCompaniesController } from './public-companies.controller.js';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  controllers: [ReviewsController, PublicCompaniesController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
