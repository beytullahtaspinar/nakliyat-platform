import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { ErrorReporterService } from './observability/error-reporter.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Canlıda tek satır JSON log: cPanel'deki stderr.log içinde aranabilir
    logger: process.env.NODE_ENV === 'production' ? new ConsoleLogger({ json: true }) : undefined,
  });
  configureApp(app);
  app.enableShutdownHooks();

  // İstek dışında kalan hatalar (zamanlayıcı, arka plan işi) da raporlansın
  const reporter = app.get(ErrorReporterService);
  process.on('unhandledRejection', (reason) => {
    reporter.capture(reason, { tags: { kind: 'unhandledRejection' } });
  });
  process.on('uncaughtException', (error) => {
    reporter.capture(error, { tags: { kind: 'uncaughtException' } });
    void reporter.flush().finally(() => process.exit(1));
  });

  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
