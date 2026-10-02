import { homedir } from 'node:os';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesController } from './files.controller.js';
import { LocalStorage } from './local-storage.js';
import { MediaService } from './media.service.js';
import { R2Storage } from './r2-storage.js';
import { RequestMediaController } from './request-media.controller.js';
import { FILE_STORAGE, MediaStorage } from './storage.js';

/** Ortam değişkenleri: docs/dosya-yukleme.md */
export function createFileStorage(config: ConfigService): MediaStorage {
  const production = config.get('NODE_ENV') === 'production';
  const local = new LocalStorage({
    // Canlıda uygulama klasörünün dışında: her sürüm kurulumunda uygulama klasörü yenilenir
    dir: config.get<string>('UPLOAD_DIR') ?? (production ? join(homedir(), 'yuklemeler') : join(process.cwd(), '.uploads')),
    publicUrl:
      config.get<string>('API_PUBLIC_URL') ??
      (production ? 'https://api.evdenevenakliyat.app' : `http://localhost:${config.get('PORT') ?? 4000}`),
    secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
  });

  const accountId = config.get<string>('R2_ACCOUNT_ID');
  const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID');
  const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY');
  const bucket = config.get<string>('R2_BUCKET');
  const r2 =
    accountId && accessKeyId && secretAccessKey && bucket
      ? new R2Storage({ accountId, accessKeyId, secretAccessKey, bucket, endpoint: config.get('R2_ENDPOINT') })
      : null;

  return new MediaStorage(local, r2, {
    local: Number(config.get('LOCAL_UPLOAD_QUOTA_MB') ?? 400) * 1024 * 1024,
    // Varsayılan 9,5 GB: R2 ücretsiz katmanı 10 GB, dolmadan R2'ye yükleme durur
    r2: Math.round(Number(config.get('R2_QUOTA_GB') ?? 9.5) * 1024 ** 3),
  });
}

@Module({
  controllers: [RequestMediaController, FilesController],
  providers: [
    MediaService,
    { provide: FILE_STORAGE, inject: [ConfigService], useFactory: createFileStorage },
  ],
  exports: [MediaService],
})
export class MediaModule {}
