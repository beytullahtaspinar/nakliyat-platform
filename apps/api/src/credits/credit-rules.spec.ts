import { DEFAULT_CREDIT_SETTINGS, expiredRefund, normalizeCreditSettings, quoteCost } from './credit-rules.js';

describe('kredi kuralları', () => {
  it('kayıt yoksa ya da bozuksa varsayılanı verir', () => {
    expect(normalizeCreditSettings(null)).toEqual(DEFAULT_CREDIT_SETTINGS);
    expect(normalizeCreditSettings('x')).toEqual(DEFAULT_CREDIT_SETTINGS);
  });

  it('geçersiz alanı varsayılanla değiştirir, geçerlileri korur', () => {
    const s = normalizeCreditSettings({ enabled: true, quoteCostLocal: 30, quoteCostIntercity: 2.5, expiredRefundPercent: 150, creditValueTry: 1.5 });
    expect(s).toMatchObject({ enabled: true, quoteCostLocal: 30, creditValueTry: 1.5 });
    expect(s.quoteCostIntercity).toBe(DEFAULT_CREDIT_SETTINGS.quoteCostIntercity);
    expect(s.expiredRefundPercent).toBe(DEFAULT_CREDIT_SETTINGS.expiredRefundPercent);
  });

  it('teklif kredisi il içi ve iller arası ayrı, kapalıyken 0', () => {
    const on = { ...DEFAULT_CREDIT_SETTINGS, enabled: true, quoteCostLocal: 40, quoteCostIntercity: 90 };
    expect(quoteCost({ fromCityCode: '34', toCityCode: '34' }, on)).toBe(40);
    expect(quoteCost({ fromCityCode: '34', toCityCode: '06' }, on)).toBe(90);
    expect(quoteCost({ fromCityCode: '34', toCityCode: '06' }, DEFAULT_CREDIT_SETTINGS)).toBe(0);
  });

  it('süre dolumu iadesini aşağı yuvarlar', () => {
    expect(expiredRefund(75, 50)).toBe(37);
    expect(expiredRefund(100, 0)).toBe(0);
    expect(expiredRefund(100, 100)).toBe(100);
  });
});
