import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { AccountController } from './account.controller.js';
import { AccountDeletionService } from './account-deletion.service.js';

@Module({
  imports: [MediaModule],
  controllers: [AccountController],
  providers: [AccountDeletionService],
  exports: [AccountDeletionService],
})
export class AccountModule {}
