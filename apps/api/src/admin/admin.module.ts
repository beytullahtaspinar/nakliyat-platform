import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { AdminCompaniesController } from './admin-companies.controller.js';
import { AdminDocumentsController } from './admin-documents.controller.js';
import { AdminOverviewController } from './admin-overview.controller.js';
import { AdminRequestsController } from './admin-requests.controller.js';
import { AdminUsersController } from './admin-users.controller.js';

@Module({
  imports: [MediaModule],
  controllers: [AdminOverviewController, AdminCompaniesController, AdminDocumentsController, AdminRequestsController, AdminUsersController],
})
export class AdminModule {}
