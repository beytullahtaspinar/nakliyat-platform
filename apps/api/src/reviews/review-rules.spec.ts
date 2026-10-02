import { maskName, moveDayReached } from './review-rules.js';

describe('maskName', () => {
  it('soyadının yalnızca baş harfini gösterir', () => {
    expect(maskName('Ayşe Yılmaz', false)).toBe('Ayşe Y.');
    expect(maskName('  mehmet ali  işık ', false)).toBe('mehmet İ.');
    expect(maskName('Cem', false)).toBe('Cem');
  });

  it('silinmiş hesabın adını göstermez', () => {
    expect(maskName('Silinmiş kullanıcı', true)).toBe('Müşteri');
    expect(maskName('   ', false)).toBe('Müşteri');
  });
});

describe('moveDayReached', () => {
  const day = new Date('2026-10-10T00:00:00.000Z');

  it('taşınma gününden önce false', () => {
    expect(moveDayReached(day, new Date('2026-10-09T20:59:00.000Z'))).toBe(false);
  });

  it('Türkiye saatiyle taşınma günü başlayınca true', () => {
    // 21:00 UTC = 00:00 TSİ
    expect(moveDayReached(day, new Date('2026-10-09T21:00:00.000Z'))).toBe(true);
    expect(moveDayReached(day, new Date('2026-10-12T08:00:00.000Z'))).toBe(true);
  });
});
