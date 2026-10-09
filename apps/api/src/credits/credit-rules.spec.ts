import {
  creditsForAmount,
  DEFAULT_CREDIT_SETTINGS,
  expiredRefund,
  formatIban,
  isValidTrIban,
  makeTransferCode,
  normalizeCreditSettings,
  quoteCost,
} from './credit-rules.js';

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

  it('IBAN: TR + 24 rakam ve mod 97 denetimi', () => {
    expect(isValidTrIban('TR330006100519786457841326')).toBe(true);
    expect(isValidTrIban('TR340006100519786457841326')).toBe(false);
    expect(isValidTrIban('DE89370400440532013000')).toBe(false);
    expect(formatIban('TR330006100519786457841326')).toBe('TR33 0006 1005 1978 6457 8413 26');
  });

  it('banka hesaplarını temizler, geçersizleri atar, en fazla 3 tutar', () => {
    const iban = 'TR33 0006 1005 1978 6457 8413 26';
    const s = normalizeCreditSettings({
      bankAccounts: [
        { bank: ' Ziraat ', holder: 'Örnek A.Ş.', iban: iban.toLowerCase() },
        { bank: 'X', holder: 'Y', iban: 'TR340006100519786457841326' },
        'bozuk',
        ...Array.from({ length: 4 }, () => ({ bank: 'B', holder: 'H', iban })),
      ],
    });
    expect(s.bankAccounts).toHaveLength(3);
    expect(s.bankAccounts[0]).toEqual({ bank: 'Ziraat', holder: 'Örnek A.Ş.', iban: 'TR330006100519786457841326' });
    expect(normalizeCreditSettings({ bankAccounts: 'x' }).bankAccounts).toEqual([]);
  });

  it('tutarın kredi karşılığı kuruş hesabıyla, aşağı yuvarlanır', () => {
    expect(creditsForAmount(1500, 1)).toBe(1500);
    expect(creditsForAmount(1000, 0.1)).toBe(10000);
    expect(creditsForAmount(100, 3)).toBe(33);
    expect(creditsForAmount(0.3, 0.1)).toBe(3);
    expect(creditsForAmount(0.5, 1)).toBe(0);
  });

  it('havale kodu karışan harf içermez', () => {
    let i = 0;
    const code = makeTransferCode((n) => i++ % n);
    expect(code).toMatch(/^EN-[2-9A-HJKMNP-Z]{6}$/);
    expect(code).toBe('EN-234567');
  });
});
