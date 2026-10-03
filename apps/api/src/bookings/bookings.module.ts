import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller.js';
import { MoveRemindersService } from './move-reminders.service.js';

@Module({ controllers: [BookingsController], providers: [MoveRemindersService] })
export class BookingsModule {}
