import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRICING_SETTINGS,
  calibrate,
  estimatePrice,
  modelPrice,
  normalizeSettings,
  type PriceInput,
} from './index.js';

const s = DEFAULT_PRICING_SETTINGS;
const base: PriceInput = {
  homeType: 'TWO_PLUS_ONE',
  fromFloor: 2,
  fromHasElevator: true,
  toFloor: 3,
  toHasElevator: true,
  needsPacking: false,
  needsAssembly: false,
};

describe('estimatePrice', () => {
  it('şehir içi 2+1 için yuvarlanmış bir aralık verir', () => {
    const e = estimatePrice(base, s);
    expect(e).toMatchObject({ band: 'local', source: 'model', volumeM3: 25, crew: 3, vehicles: 1 });
    // 3.000 + 25 × 450 + 3.500 = 17.750
    expect(e.midTry).toBe(18_000);
    expect(e.minTry).toBe(15_000);
    expect(e.maxTry).toBe(20_500);
    expect(e.minTry % 500).toBe(0);
  });

  it('mesafe, kat, eşya miktarı ve ek hizmetler fiyatı artırır', () => {
    const local = estimatePrice(base, s).midTry;
    expect(estimatePrice({ ...base, distanceKm: 450 }, s).midTry).toBeGreaterThan(local);
    expect(estimatePrice({ ...base, fromHasElevator: false }, s).midTry).toBeGreaterThan(local);
    expect(estimatePrice({ ...base, load: 'HEAVY' }, s).midTry).toBeGreaterThan(local);
    expect(estimatePrice({ ...base, load: 'LIGHT' }, s).midTry).toBeLessThan(local);
    expect(estimatePrice({ ...base, needsPacking: true, needsAssembly: true }, s).midTry).toBeGreaterThan(local);
  });

  it('kapasiteyi aşan hacimde ikinci araç hesaplar', () => {
    expect(estimatePrice({ ...base, homeType: 'VILLA', distanceKm: 500 }, s).vehicles).toBe(2);
  });

  it('kısa şehirler arası yol şehir içi ücretin altına inmez', () => {
    expect(modelPrice({ ...base, distanceKm: 20 }, s).breakdown.transport).toBe(s.localTransportTry);
  });

  it('ayarlama varsa platform verisini kullanır', () => {
    const e = estimatePrice(base, s, { local: { factor: 1.2, spreadPct: 10, samples: 12 } });
    expect(e).toMatchObject({ source: 'platform', samples: 12 });
    expect(e.midTry).toBe(21_500);
    // Ayarlama yalnızca kendi grubuna uygulanır
    expect(estimatePrice({ ...base, distanceKm: 300 }, s, { local: { factor: 1.2, spreadPct: 10, samples: 12 } }).source).toBe('model');
  });
});

describe('calibrate', () => {
  const sample = (ratio: number, distanceKm?: number) => {
    const input = { ...base, distanceKm };
    return { input, priceTry: modelPrice(input, s).total * ratio };
  };

  it('eşik altındaki grubu ayarlamaz', () => {
    expect(calibrate([sample(1.1), sample(1.2)], s)).toEqual({});
  });

  it('ortanca oran ve dağılımdan ayar çıkarır', () => {
    const ratios = [0.9, 1, 1.1, 1.2, 1.2, 1.2, 1.3, 1.4, 1.5, 1.6];
    const result = calibrate(ratios.map((r) => sample(r)), s);
    expect(result.local).toMatchObject({ factor: 1.2, samples: 10 });
    expect(result.intercity).toBeUndefined();
    expect(result.local!.spreadPct).toBeGreaterThanOrEqual(8);
  });

  it('uç oranları sınırlar', () => {
    const result = calibrate(Array.from({ length: 10 }, () => sample(10, 400)), s);
    expect(result.intercity?.factor).toBe(2.5);
  });
});

describe('normalizeSettings', () => {
  it('geçersiz değerlerde varsayılanı kullanır', () => {
    expect(normalizeSettings({ baseFeeTry: -5, perKmTry: 60, x: 1 })).toEqual({ ...s, perKmTry: 60 });
    expect(normalizeSettings(null)).toEqual(s);
  });
});
