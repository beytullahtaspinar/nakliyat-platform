import { createWriteStream } from 'node:fs';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  PayloadTooLargeException,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { LocalStorage } from './local-storage.js';
import { MIME_BY_EXTENSION } from './media-rules.js';
import { FILE_STORAGE, type FileStorage } from './storage.js';

/**
 * Yalnızca yerel disk sürücüsünde kullanılır (R2'de tarayıcı doğrudan R2'ye gider).
 * Yetki, MediaService'in verdiği imzalı ve süreli belirteçle sağlanır.
 */
@ApiExcludeController()
@Public()
@Controller('files')
export class FilesController {
  constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}

  @Put('upload/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async upload(@Param('token') token: string, @Req() req: Request) {
    const local = this.local();
    const grant = local.verify(token, 'put');
    if (!grant) throw new ForbiddenException('Yükleme adresinin süresi dolmuş, tekrar deneyin');
    if (req.headers['content-type'] !== grant.t) throw new BadRequestException('Dosya türü uyuşmuyor');
    const declared = Number(req.headers['content-length']);
    if (declared !== grant.s) throw new BadRequestException('Dosya boyutu uyuşmuyor');

    const write = await local.prepareWrite(grant.k);
    let received = 0;
    const limit = new Transform({
      transform(chunk: Buffer, _enc, done) {
        received += chunk.length;
        done(received > grant.s! ? new PayloadTooLargeException('Dosya bildirilenden büyük') : null, chunk);
      },
    });
    try {
      await pipeline(req, limit, createWriteStream(write.temp));
      if (received !== grant.s) throw new BadRequestException('Yükleme yarıda kaldı');
      await write.commit();
    } catch (err) {
      await write.discard();
      throw err;
    }
  }

  @Get(':token')
  @SkipThrottle()
  show(@Param('token') token: string, @Res() res: Response) {
    const local = this.local();
    const grant = local.verify(token, 'get');
    if (!grant) throw new NotFoundException();
    res.sendFile(local.path(grant.k), {
      headers: {
        'Content-Type': MIME_BY_EXTENSION[grant.k.split('.').pop() ?? ''] ?? 'application/octet-stream',
        // Görseller web sitesinde gösterilebilsin. Adres zaten imzalı ve süreli bir erişim belgesi
        // (R2'deki imzalı adreslerle aynı); helmet'in varsayılanı (same-origin) <img> ile göstermeyi engeller.
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'X-Content-Type-Options': 'nosniff',
        // Kişisel fotoğraf: ara sunucularda değil yalnızca kullanıcının tarayıcısında önbelleğe alınır
        'Cache-Control': 'private, max-age=3600, immutable',
      },
      // Geliştirmede klasör .uploads (nokta ile başlıyor); yol zaten anahtar kalıbıyla doğrulandı
      dotfiles: 'allow',
      cacheControl: false,
      lastModified: false,
      etag: false,
    }, (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  }

  private local(): LocalStorage {
    if (!(this.storage instanceof LocalStorage)) throw new NotFoundException();
    return this.storage;
  }
}
