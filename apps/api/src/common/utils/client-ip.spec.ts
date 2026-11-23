import { describe, expect, it } from 'vitest';
import { clientIpForLimit } from './client-ip.js';

const req = (remoteAddress: string | undefined, xff?: string) =>
  ({ socket: { remoteAddress }, headers: xff === undefined ? {} : { 'x-forwarded-for': xff } }) as never;

describe('clientIpForLimit', () => {
  it('vekil arkasında vekilin eklediği son değeri alır (başa yazılan sahte değer işe yaramaz)', () => {
    expect(clientIpForLimit(req('127.0.0.1', '1.1.1.1, 85.105.10.20'))).toBe('85.105.10.20');
    expect(clientIpForLimit(req(undefined, '85.105.10.20'))).toBe('85.105.10.20');
    expect(clientIpForLimit(req('::ffff:127.0.0.1', '::ffff:85.105.10.20'))).toBe('85.105.10.20');
  });

  it('doğrudan bağlantıda başlığa güvenmez', () => {
    expect(clientIpForLimit(req('85.105.10.20', '1.1.1.1'))).toBe('85.105.10.20');
  });

  it('vekil başlık eklemediyse bağlantı adresi', () => {
    expect(clientIpForLimit(req('127.0.0.1'))).toBe('127.0.0.1');
  });
});
