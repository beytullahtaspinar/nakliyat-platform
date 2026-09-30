import { Module } from '@nestjs/common';
import { AdminCompaniesController } from './admin-companies.controller.js';

@Module({ controllers: [AdminCompaniesController] })
export class AdminModule {}
