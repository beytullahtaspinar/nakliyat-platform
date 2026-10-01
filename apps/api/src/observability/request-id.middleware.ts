import { Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'X-Request-Id';
const VALID_ID = /^[A-Za-z0-9_-]{6,64}$/;
/** Bu süreyi aşan istekler "yavaş istek" olarak loglanır */
const SLOW_REQUEST_MS = 1000;

declare module 'express' {
  interface Request {
    requestId?: string;
  }
}

const logger = new Logger('HTTP');

/**
 * Her isteğe bir kimlik verir ve yanıt başlığına yazar. Hata yanıtlarında ve loglarda aynı kimlik
 * görünür; kullanıcı "hata aldım" dediğinde bu kodla ilgili log satırı bulunur.
 * Web uygulaması kendi kimliğini gönderirse (X-Request-Id) o kullanılır.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.get(REQUEST_ID_HEADER);
  const id = incoming && VALID_ID.test(incoming) ? incoming : randomBytes(6).toString('hex');
  req.requestId = id;
  res.setHeader(REQUEST_ID_HEADER, id);

  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Math.round(Number(process.hrtime.bigint() - started) / 1e6);
    // Başarılı ve hızlı istekleri loglamıyoruz (disk 2 GB); 5xx hatalar zaten ayrıca raporlanıyor.
    if (durationMs >= SLOW_REQUEST_MS) {
      logger.warn({
        message: 'Yavaş istek',
        requestId: id,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        durationMs,
      });
    }
  });
  next();
}
