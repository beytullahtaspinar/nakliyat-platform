import { formatPlate, normalizePlate, PLATE_PATTERN } from './vehicle-rules.js';

describe('plaka kuralları', () => {
  it('boşluk, tire ve küçük harfle yazılan plakayı ruhsattaki biçime çevirir', () => {
    expect(normalizePlate('34 abc 123')).toBe('34ABC123');
    expect(normalizePlate('06-ık-4567')).toBe('06IK4567');
    expect(normalizePlate(' 81 qwx 4321 ')).toBe('81QWX4321');
  });

  it('il kodu 01-81, 1-3 harf ve 2-5 rakam olmalı', () => {
    for (const plate of ['34ABC123', '01A1234', '81AB12', '06K12345']) expect(PLATE_PATTERN.test(plate)).toBe(true);
    for (const plate of ['00ABC123', '82ABC123', '34ABCD123', '34ABC1', '34123', 'ABC123', '34ÇAB123']) {
      expect(PLATE_PATTERN.test(plate)).toBe(false);
    }
  });

  it('plakayı okunur biçimde gösterir', () => {
    expect(formatPlate('34ABC123')).toBe('34 ABC 123');
    expect(formatPlate('06K12345')).toBe('06 K 12345');
  });
});
