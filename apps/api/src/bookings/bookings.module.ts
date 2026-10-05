import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller.js';
import { CompanyOverviewController } from './company-overview.controller.js';
import { MoveRemindersService } from './move-reminders.service.js';

@Module({ controllers: [BookingsController, CompanyOverviewController], providers: [MoveRemindersService] })
export class BookingsModule {}
