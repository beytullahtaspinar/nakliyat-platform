import { NAME_CHANGE_LIMIT, nameChangeQuota, normalizeName } from './name-change-rules.js';

const now = new Date('2026-10-06T10:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

describe('görünen ad değişikliği sınırı', () => {
  it('hiç değişiklik yoksa tüm haklar duruyor', () => {
    expect(nameChangeQuota([], now)).toEqual({ limit: NAME_CHANGE_LIMIT, used: 0, remaining: 2, nextAvailableAt: null });
  });

  it('365 günden eski onaylar sayılmıyor', () => {
    expect(nameChangeQuota([daysAgo(400), daysAgo(10)], now)).toMatchObject({ used: 1, remaining: 1 });
  });

  it('hak bitince en eski onayın bir yıl sonrasını veriyor', () => {
    const quota = nameChangeQuota([daysAgo(10), daysAgo(100)], now);
    expect(quota).toMatchObject({ used: 2, remaining: 0 });
    expect(quota.nextAvailableAt).toEqual(new Date(daysAgo(100).getTime() + 365 * 86_400_000));
  });

  it('boşluk farkını değişiklik saymıyor', () => {
    expect(normalizeName('  Örnek   Nakliyat ')).toBe('Örnek Nakliyat');
  });
});
