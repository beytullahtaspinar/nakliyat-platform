import { autoCompleteDay, followUpWindow, maskName, moveDayReached } from './review-rules.js';

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

describe('taşınma sonrası takip', () => {
  it('saat 10:00 TSİ olmadan bildirim turu çalışmaz', () => {
    expect(followUpWindow(new Date('2026-10-15T06:59:00Z'))).toBeNull(); // 09:59 TSİ
  });

  it('dünden 6 gün öncesine kadar soru, daha eskiler tamamlanır', () => {
    expect(followUpWindow(new Date('2026-10-15T07:00:00Z'))).toEqual({
      checkFrom: '2026-10-09',
      checkTo: '2026-10-15',
      completeBefore: '2026-10-09',
    });
  });

  it('otomatik tamamlama günü taşınmadan 7 gün sonra', () => {
    expect(autoCompleteDay(new Date('2026-10-08T00:00:00.000Z'))).toBe('2026-10-15');
    expect(autoCompleteDay(new Date('2026-12-28T00:00:00.000Z'))).toBe('2027-01-04');
  });
});
