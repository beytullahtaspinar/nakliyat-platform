import { homedir } from 'node:os';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyDocumentsController } from './company-documents.controller.js';
import { CompanyDocumentsService } from './company-documents.service.js';
import { FilesController } from './files.controller.js';
import { LocalStorage } from './local-storage.js';
import { MediaService } from './media.service.js';
import { R2Storage } from './r2-storage.js';
import { RequestMediaController } from './request-media.controller.js';
import { FILE_STORAGE, type FileStorage } from './storage.js';

/** Ortam değişkenleri: docs/dosya-yukleme.md */
export function createFileStorage(config: ConfigService): FileStorage {
  const accountId = config.get<string>('R2_ACCOUNT_ID');
  const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID');
  const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY');
  const bucket = config.get<string>('R2_BUCKET');
  const production = config.get('NODE_ENV') === 'production';
  const publicUrl =
    config.get<string>('API_PUBLIC_URL') ??
    (production ? 'https://api.evdenevenakliyat.app' : `http://localhost:${config.get('PORT') ?? 4000}`);
  const secret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
  if (accountId && accessKeyId && secretAccessKey && bucket) {
    return new R2Storage({
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      endpoint: config.get('R2_ENDPOINT'),
      // Varsayılan 9,5 GB: R2 ücretsiz katmanı 10 GB, dolmadan yükleme durur
      quotaBytes: Math.round(Number(config.get('R2_QUOTA_GB') ?? 9.5) * 1024 ** 3),
      publicUrl,
      secret,
    });
  }

  return new LocalStorage({
    // Canlıda uygulama klasörünün dışında: her sürüm kurulumunda uygulama klasörü yenilenir
    dir: config.get<string>('UPLOAD_DIR') ?? (production ? join(homedir(), 'yuklemeler') : join(process.cwd(), '.uploads')),
    publicUrl,
    secret,
    quotaBytes: Number(config.get('LOCAL_UPLOAD_QUOTA_MB') ?? 400) * 1024 * 1024,
  });
}

@Module({
  controllers: [RequestMediaController, CompanyDocumentsController, FilesController],
  providers: [
    MediaService,
    CompanyDocumentsService,
    { provide: FILE_STORAGE, inject: [ConfigService], useFactory: createFileStorage },
  ],
  exports: [MediaService, CompanyDocumentsService],
})
export class MediaModule {}
