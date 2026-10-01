import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { ErrorReporterService } from './error-reporter.service.js';

@Global()
@Module({
  providers: [ErrorReporterService, { provide: APP_FILTER, useClass: AllExceptionsFilter }],
  exports: [ErrorReporterService],
})
export class ObservabilityModule {}
