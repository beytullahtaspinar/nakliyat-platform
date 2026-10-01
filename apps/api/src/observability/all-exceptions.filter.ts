import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorReporterService } from './error-reporter.service.js';

type ErrorBody = Record<string, unknown> & { statusCode: number };

/**
 * Tüm hataların yanıt biçimini tek yerde belirler: { statusCode, message, error, requestId }.
 * - Beklenen hatalar (4xx) olduğu gibi döner, raporlanmaz.
 * - Beklenmeyen hatalar (5xx) loglanır ve Sentry'ye gider; kullanıcıya iç ayrıntı gösterilmez,
 *   destek için hata kodu (requestId) verilir.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly reporter: ErrorReporterService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { user?: { role?: string } }>();
    const res = ctx.getResponse<Response>();
    const requestId = req.requestId;

    const body = toBody(exception);
    if (body.statusCode >= 500 && body.statusCode !== HttpStatus.SERVICE_UNAVAILABLE) {
      this.reporter.capture(exception, {
        requestId,
        method: req.method,
        path: req.originalUrl,
        tags: { status: body.statusCode, role: req.user?.role },
      });
    }

    if (res.headersSent) return;
    res.status(body.statusCode).json({ ...body, requestId });
  }
}

function toBody(exception: unknown): ErrorBody {
  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();
    if (typeof response === 'string') return { statusCode, message: response, error: exception.name };
    return { statusCode, ...(response as Record<string, unknown>) };
  }

  // Express katmanının hataları (bozuk JSON, çok büyük gövde vb.) statusCode taşır
  const status = (exception as { statusCode?: unknown; status?: unknown } | null)?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return {
      statusCode: status,
      message: status === 413 ? 'İstek gövdesi çok büyük.' : 'İstek okunamadı.',
      error: 'Bad Request',
    };
  }

  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Beklenmeyen bir hata oluştu. Lütfen biraz sonra tekrar deneyin.',
    error: 'Internal Server Error',
  };
}
