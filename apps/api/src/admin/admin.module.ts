import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { ReviewsModule } from '../reviews/reviews.module.js';
import { AdminCompaniesController } from './admin-companies.controller.js';
import { AdminDocumentsController } from './admin-documents.controller.js';
import { AdminOverviewController } from './admin-overview.controller.js';
import { AdminRequestsController } from './admin-requests.controller.js';
import { AdminReviewsController } from './admin-reviews.controller.js';
import { AdminStatsController } from './admin-stats.controller.js';
import { AdminUsersController } from './admin-users.controller.js';

@Module({
  imports: [MediaModule, ReviewsModule],
  controllers: [AdminOverviewController, AdminCompaniesController, AdminDocumentsController, AdminRequestsController, AdminReviewsController, AdminStatsController, AdminUsersController],
})
export class AdminModule {}
