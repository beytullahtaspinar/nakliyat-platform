import { Module } from '@nestjs/common';
import { AdminCompaniesController } from './admin-companies.controller.js';
import { AdminOverviewController } from './admin-overview.controller.js';
import { AdminRequestsController } from './admin-requests.controller.js';
import { AdminUsersController } from './admin-users.controller.js';

@Module({
  controllers: [AdminOverviewController, AdminCompaniesController, AdminRequestsController, AdminUsersController],
})
export class AdminModule {}
