import { ArgumentsHost, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import type { ErrorReporterService } from './error-reporter.service.js';

function setup() {
  const capture = vi.fn().mockReturnValue('olay1');
  const filter = new AllExceptionsFilter({ capture } as unknown as ErrorReporterService);
  const json = vi.fn();
  const res = { headersSent: false, status: vi.fn().mockReturnThis(), json };
  const req = { requestId: 'abc123def456', method: 'POST', originalUrl: '/v1/requests?x=1', user: { role: 'CUSTOMER' } };
  const host = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ArgumentsHost;
  return { filter, capture, res, json, host };
}

describe('AllExceptionsFilter', () => {
  it('beklenen hatayı (4xx) olduğu gibi döner, istek kimliğini ekler, raporlamaz', () => {
    const { filter, capture, res, json, host } = setup();
    filter.catch(new NotFoundException('Talep bulunamadı'), host);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'Talep bulunamadı',
      error: 'Not Found',
      requestId: 'abc123def456',
    });
    expect(capture).not.toHaveBeenCalled();
  });

  it('beklenmeyen hatada iç ayrıntıyı gizler ve raporlar', () => {
    const { filter, capture, res, json, host } = setup();
    const error = new Error('Prisma: bağlantı havuzu doldu');
    filter.catch(error, host);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.message).not.toContain('Prisma');
    expect(body).toMatchObject({ statusCode: 500, requestId: 'abc123def456' });
    expect(capture).toHaveBeenCalledWith(error, {
      requestId: 'abc123def456',
      method: 'POST',
      path: '/v1/requests?x=1',
      tags: { status: 500, role: 'CUSTOMER' },
    });
  });

  it('Express katmanı hatalarını (bozuk JSON) 400 olarak döner', () => {
    const { filter, capture, res, host } = setup();
    filter.catch(Object.assign(new SyntaxError('Unexpected token'), { statusCode: 400 }), host);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(capture).not.toHaveBeenCalled();
  });

  it('bakım/veritabanı kesintisini (503) gövdesiyle döner, hata fırtınası yaratmaz', () => {
    const { filter, capture, json, host } = setup();
    filter.catch(new ServiceUnavailableException({ status: 'error', database: 'down' }), host);
    expect(json).toHaveBeenCalledWith({ status: 'error', database: 'down', statusCode: 503, requestId: 'abc123def456' });
    expect(capture).not.toHaveBeenCalled();
  });
});
