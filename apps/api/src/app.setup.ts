import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { requestIdMiddleware } from './observability/request-id.middleware.js';

export const API_PREFIX = 'v1';

export function buildOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('evdenevenakliyat.app API')
    .setDescription(
      'Evden eve taşınma pazaryeri REST API. Korunan uç noktalar için `Authorization: Bearer <accessToken>` başlığı gerekir.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}

export function configureApp(app: INestApplication) {
  app.setGlobalPrefix(API_PREFIX);
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.enableCors({
    origin: process.env.WEB_URL ?? 'http://localhost:3000',
    exposedHeaders: ['X-Request-Id'],
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  SwaggerModule.setup('docs', app, () => buildOpenApiDocument(app));
}
