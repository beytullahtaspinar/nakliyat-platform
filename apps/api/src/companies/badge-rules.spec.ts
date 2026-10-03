import { describe, expect, it } from 'vitest';
import { earnsFastResponse, earnsTopRated, median } from './badge-rules.js';

describe('rozet kuralları', () => {
  it('ortanca', () => {
    expect(median([])).toBeNull();
    expect(median([30])).toBe(30);
    expect(median([600, 10, 20])).toBe(20);
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it('hızlı yanıt: en az 5 teklif ve ortanca 3 saat', () => {
    expect(earnsFastResponse({ quoteCount: 5, medianMinutes: 180 })).toBe(true);
    expect(earnsFastResponse({ quoteCount: 5, medianMinutes: 181 })).toBe(false);
    expect(earnsFastResponse({ quoteCount: 4, medianMinutes: 5 })).toBe(false);
    expect(earnsFastResponse({ quoteCount: 0, medianMinutes: null })).toBe(false);
  });

  it('yüksek puan: en az 5 yorumda 4,5', () => {
    expect(earnsTopRated(4.5, 5)).toBe(true);
    expect(earnsTopRated(4.49, 20)).toBe(false);
    expect(earnsTopRated(5, 4)).toBe(false);
  });
});
