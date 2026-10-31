import { describe, expect, it, vi } from 'vitest';
import { ErrorReporterService } from '../observability/error-reporter.service.js';
import { databaseUnreachable } from './database-errors.js';

/** Canlıdaki NAKLIYAT-C hatasının Prisma 7 + MariaDB sürücüsündeki biçimi */
function poolTimeout(active: number, cause?: string) {
  const message = `pool timeout: failed to retrieve a connection from pool after 10000ms\n    (pool connections: active=${active} idle=0 limit=5)`;
  return Object.assign(
    new Error(
      `\nInvalid \`prisma.cardPayment.findMany()\` invocation:\n\n\nDatabase error. Code: \`45028\`. Message: \`${message}\``,
    ),
    {
      name: 'PrismaClientKnownRequestError',
      code: 'P2039',
      meta: {
        modelName: 'CardPayment',
        driverAdapterError: {
          name: 'DriverAdapterError',
          cause: { kind: 'mysql', code: 45028, message, state: 'HY000', cause },
        },
      },
    },
  );
}

describe('databaseUnreachable', () => {
  it('havuzda hiç bağlantı yokken zaman aşımını bağlantı hatası sayar ve asıl sebebi çıkarır', () => {
    expect(
      databaseUnreachable(
        poolTimeout(0, 'connect ECONNREFUSED 127.0.0.1:3306'),
      ),
    ).toEqual({
      cause: 'connect ECONNREFUSED 127.0.0.1:3306',
    });
    expect(databaseUnreachable(poolTimeout(0))).toEqual({ cause: undefined });
  });

  it('açık bağlantı varken zaman aşımı (havuz dolu) ve diğer hatalar bağlantı hatası değildir', () => {
    expect(databaseUnreachable(poolTimeout(5, 'x'))).toBeNull();
    expect(databaseUnreachable(new Error('boom'))).toBeNull();
    expect(databaseUnreachable({ code: 'P2002', meta: {} })).toBeNull();
    expect(databaseUnreachable(undefined)).toBeNull();
  });

  it("Prisma'nın P1001 (sunucuya ulaşılamıyor) hatasını da kapsar", () => {
    expect(databaseUnreachable({ code: 'P1001' })).toEqual({
      cause: undefined,
    });
  });
});

describe('ErrorReporterService veritabanı hataları', () => {
  function setup() {
    const service = new ErrorReporterService();
    const capture = vi.fn().mockReturnValue('olay');
    (service as unknown as { reporter: { capture: typeof capture } }).reporter =
      { capture };
    return { service, capture };
  }

  it('bağlantı hatasını tek Sentry kaydına toplar ve asıl sebebi başlığa yazar', () => {
    const { service, capture } = setup();
    service.capture(
      poolTimeout(
        0,
        "Access denied for user 'evdene11_x'@'localhost' (using password: YES)",
      ),
      {
        tags: { job: 'card-payments-reconcile' },
      },
    );
    const [err, ctx] = capture.mock.calls[0];
    expect(err.name).toBe('DatabaseUnreachable');
    expect(err.message).toBe(
      "Veritabanına bağlanılamıyor: Access denied for user 'evdene11_x'@'localhost' (using password: YES) (Invalid `prisma.cardPayment.findMany()` invocation:)",
    );
    expect(err.stack.split('\n')[0]).toBe(
      `DatabaseUnreachable: ${err.message}`,
    );
    expect(ctx).toEqual({
      tags: { job: 'card-payments-reconcile', database: 'erisilemiyor' },
      fingerprint: ['veritabani-erisilemiyor'],
    });
  });

  it('diğer hatalara dokunmaz', () => {
    const { service, capture } = setup();
    const err = new Error('boom');
    service.capture(err, { tags: { job: 'x' } });
    expect(capture).toHaveBeenCalledWith(err, { tags: { job: 'x' } });
  });
});
