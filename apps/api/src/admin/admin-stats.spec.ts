import { fillDays, ratio, statsRange, trDayKey } from './admin-stats.js';

describe('yönetim istatistikleri yardımcıları', () => {
  it('dönemi Türkiye saatiyle gün başından başlatır', () => {
    // 3 Ekim 01:30 TSİ = 2 Ekim 22:30 UTC
    const now = new Date('2026-10-02T22:30:00Z');
    const { from, previousFrom } = statsRange(7, now);
    expect(from.toISOString()).toBe('2026-09-26T21:00:00.000Z'); // 27 Eylül 00:00 TSİ
    expect(previousFrom.toISOString()).toBe('2026-09-19T21:00:00.000Z');
    expect(trDayKey(now)).toBe('2026-10-03');
  });

  it('boş günleri sıfırla doldurur', () => {
    const { from } = statsRange(3, new Date('2026-10-03T09:00:00Z'));
    expect(fillDays(from, 3, [{ day: '2026-10-02', count: 4 }])).toEqual([
      { day: '2026-10-01', count: 0 },
      { day: '2026-10-02', count: 4 },
      { day: '2026-10-03', count: 0 },
    ]);
  });

  it('paydası sıfır olan oran null olur', () => {
    expect(ratio(1, 0)).toBeNull();
    expect(ratio(1, 3)).toBe(0.333);
  });
});
