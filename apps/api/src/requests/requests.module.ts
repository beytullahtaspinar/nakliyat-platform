import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { VerificationModule } from '../verification/verification.module.js';
import { RequestsController } from './requests.controller.js';
import { RequestsService } from './requests.service.js';

@Module({
  imports: [MediaModule, VerificationModule],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}
