// OpenAPI şemasını docs/openapi.json dosyasına yazar: pnpm --filter @nakliyat/api openapi:export
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp, buildOpenApiDocument } from './app.setup.js';

const app = await NestFactory.create(AppModule, { logger: false });
configureApp(app);
const target = resolve(import.meta.dirname, '../../../docs/openapi.json');
writeFileSync(target, JSON.stringify(buildOpenApiDocument(app), null, 2) + '\n');
await app.close();
console.log(`OpenAPI şeması yazıldı: ${target}`);
