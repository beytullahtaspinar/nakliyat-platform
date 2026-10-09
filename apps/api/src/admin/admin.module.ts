import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module.js';
import { MediaModule } from '../media/media.module.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { ReviewsModule } from '../reviews/reviews.module.js';
import { AdminCompaniesController } from './admin-companies.controller.js';
import { AdminCreditsController } from './admin-credits.controller.js';
import { AdminDocumentsController } from './admin-documents.controller.js';
import { AdminNameChangesController } from './admin-name-changes.controller.js';
import { AdminOverviewController } from './admin-overview.controller.js';
import { AdminPricingController } from './admin-pricing.controller.js';
import { AdminRequestsController } from './admin-requests.controller.js';
import { AdminReviewsController } from './admin-reviews.controller.js';
import { AdminStatsController } from './admin-stats.controller.js';
import { AdminUsersController } from './admin-users.controller.js';

@Module({
  imports: [AccountModule, MediaModule, PricingModule, ReviewsModule],
  controllers: [AdminOverviewController, AdminCompaniesController, AdminCreditsController, AdminPricingController, AdminDocumentsController, AdminNameChangesController, AdminRequestsController, AdminReviewsController, AdminStatsController, AdminUsersController],
})
export class AdminModule {}
