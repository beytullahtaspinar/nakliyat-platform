import { Module } from '@nestjs/common';
import { BookingFollowUpService } from './booking-follow-up.service.js';
import { PublicCompaniesController, PublicReviewsController } from './public-companies.controller.js';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  controllers: [ReviewsController, PublicCompaniesController, PublicReviewsController],
  providers: [ReviewsService, BookingFollowUpService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
