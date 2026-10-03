import { pipeline } from 'node:stream/promises';
import { Controller, Get, Logger, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { CompanyShowcaseService } from './company-showcase.service.js';
import { STORAGE_KEY_PATTERN } from './media-rules.js';

/**
 * Firma tanıtım sayfasındaki logo ve fotoğraflar, kalıcı adresle. Web sitesi bunları kendi alan adından
 * (/medya/firmalar/...) aktarır; böylece görseller ayrı bağlantı açmadan yüklenir ve Google'da sitenin
 * görseli olarak görünür. Gizlenen görsel ya da yayında olmayan firma için 404.
 */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('public-media')
export class PublicMediaController {
  private readonly logger = new Logger(PublicMediaController.name);

  constructor(private readonly showcase: CompanyShowcaseService) {}

  @Get('firmalar/:companyId/:file')
  async show(@Param('companyId') companyId: string, @Param('file') file: string, @Res() res: Response) {
    const key = `firmalar/${companyId}/${file}`;
    if (!STORAGE_KEY_PATTERN.test(key)) throw new NotFoundException();
    const found = await this.showcase.readPublic(key);
    if (!found) throw new NotFoundException();
    res.set({
      'Content-Type': found.mimeType,
      ...(found.sizeBytes > 0 && { 'Content-Length': String(found.sizeBytes) }),
      // Dosya adı rastgele ve içerik değişmez: tarayıcıda bir yıl. Ara sunucularda bir saat
      // (yönetici gizlediğinde en geç bir saatte her yerden kalksın).
      'Cache-Control': 'public, max-age=31536000, s-maxage=3600, immutable',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
    });
    try {
      await pipeline(found.body, res);
    } catch (err) {
      this.logger.warn(`Görsel gönderilemedi (${key}): ${(err as Error).message}`);
      res.destroy();
    }
  }
}
