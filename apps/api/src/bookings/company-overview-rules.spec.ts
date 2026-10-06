import { describe, expect, it } from 'vitest';
import { monthRange, winRate } from './company-overview-rules.js';

describe('monthRange', () => {
  it('ayın ilk günü ve sonraki ayın ilk günü', () => {
    expect(monthRange('2026-10-05')).toEqual({ first: '2026-10-01', next: '2026-11-01' });
    expect(monthRange('2026-12-31')).toEqual({ first: '2026-12-01', next: '2027-01-01' });
    expect(monthRange('2028-02-29')).toEqual({ first: '2028-02-01', next: '2028-03-01' });
  });
});

describe('winRate', () => {
  it('kabul / sonuçlanan; bekleyen ve geri çekilen sayılmaz', () => {
    expect(winRate({ ACCEPTED: 1, REJECTED: 2, EXPIRED: 1, PENDING: 5, WITHDRAWN: 3 })).toBe(0.25);
  });
  it('sonuçlanan teklif yoksa null', () => {
    expect(winRate({ PENDING: 2 })).toBeNull();
    expect(winRate({})).toBeNull();
  });
});
