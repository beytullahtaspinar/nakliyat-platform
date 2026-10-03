import { addDays, reminderDay } from './calendar-rules.js';

describe('reminderDay', () => {
  it('Türkiye saatiyle 10:00 öncesi hatırlatma zamanı değil', () => {
    expect(reminderDay(new Date('2026-10-03T06:59:00Z'))).toBeNull(); // 09:59 TSİ
  });

  it('10:00 sonrası yarının gününü verir', () => {
    expect(reminderDay(new Date('2026-10-03T07:00:00Z'))).toBe('2026-10-04');
  });

  it('gece yarısından sonra (TSİ) sabah 10:00\'a kadar gönderilmez', () => {
    expect(reminderDay(new Date('2026-10-03T22:30:00Z'))).toBeNull(); // 4 Ekim 01:30 TSİ
    expect(reminderDay(new Date('2026-10-04T07:30:00Z'))).toBe('2026-10-05'); // 4 Ekim 10:30 TSİ
  });

  it('ay ve yıl sonunu aşar', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
  });
});
