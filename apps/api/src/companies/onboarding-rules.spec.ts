import { canRemindManually, dueOnboardingStep, isSendingHour, lastOnboardingProgress, onboardingMissing } from './onboarding-rules.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// 2 Kasım 2026 12:00 TSİ
const now = new Date('2026-11-02T09:00:00Z');
const user = (ageMs: number, step = 0, remindedAgoMs?: number) => ({
  createdAt: new Date(now.getTime() - ageMs),
  onboardingReminderStep: step,
  onboardingRemindedAt: remindedAgoMs === undefined ? null : new Date(now.getTime() - remindedAgoMs),
});

describe('firma kaydı hatırlatma kuralları', () => {
  it('ilk gün dolmadan hatırlatma yok', () => {
    expect(dueOnboardingStep(user(23 * HOUR), now)).toBeNull();
  });

  it('1. gün birinci, 3. gün ikinci hatırlatma', () => {
    expect(dueOnboardingStep(user(DAY), now)).toBe(1);
    expect(dueOnboardingStep(user(2 * DAY, 1), now)).toBeNull();
    expect(dueOnboardingStep(user(3 * DAY, 1), now)).toBe(2);
    expect(dueOnboardingStep(user(5 * DAY, 2), now)).toBeNull();
  });

  it('iki adım birden geçmişse yalnızca sonuncusu gider', () => {
    expect(dueOnboardingStep(user(4 * DAY), now)).toBe(2);
  });

  it('10 günden eski hesaplara otomatik hatırlatma gitmez', () => {
    expect(dueOnboardingStep(user(11 * DAY), now)).toBeNull();
  });

  it('yönetici 12 saat içinde hatırlattıysa otomatik hatırlatma bekler', () => {
    expect(dueOnboardingStep(user(DAY, 0, 2 * HOUR), now)).toBeNull();
    expect(dueOnboardingStep(user(DAY, 0, 13 * HOUR), now)).toBe(1);
    expect(canRemindManually(new Date(now.getTime() - 11 * HOUR), now)).toBe(false);
    expect(canRemindManually(null, now)).toBe(true);
  });

  it('yalnızca TSİ 09:00-21:00 arasında gönderilir', () => {
    expect(isSendingHour(new Date('2026-11-02T05:59:00Z'))).toBe(false); // 08:59 TSİ
    expect(isSendingHour(new Date('2026-11-02T06:00:00Z'))).toBe(true); // 09:00 TSİ
    expect(isSendingHour(new Date('2026-11-02T17:59:00Z'))).toBe(true); // 20:59 TSİ
    expect(isSendingHour(new Date('2026-11-02T18:00:00Z'))).toBe(false); // 21:00 TSİ
  });
});

describe('kaydı yarım firmanın eksikleri', () => {
  const company = (documents: { type: 'K3_LICENSE' | 'TAX_CERTIFICATE' | 'TRADE_REGISTRY'; status: 'PENDING' | 'VERIFIED' | 'REJECTED' }[], vehicles: ('PENDING' | 'VERIFIED' | 'REJECTED')[] = [], verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' = 'PENDING') => ({
    verificationStatus,
    documents,
    vehicles: vehicles.map((status) => ({ status })),
  });

  it('firma bilgisi yoksa yalnızca firma bilgileri eksik', () => {
    expect(onboardingMissing(null)).toEqual(['Firma bilgileri']);
  });

  it('yalnızca vergi levhası onaylıysa kalan belgeler ve araç eksik', () => {
    expect(onboardingMissing(company([{ type: 'TAX_CERTIFICATE', status: 'VERIFIED' }]))).toEqual([
      'K3 yetki belgesi',
      'Ticaret sicil gazetesi / faaliyet belgesi',
      'Araç (ruhsat ve plakalı fotoğraflar)',
    ]);
  });

  it('incelemedeki belge eksik sayılmaz, reddedilen sayılır', () => {
    const docs = [
      { type: 'K3_LICENSE' as const, status: 'PENDING' as const },
      { type: 'TAX_CERTIFICATE' as const, status: 'VERIFIED' as const },
      { type: 'TRADE_REGISTRY' as const, status: 'REJECTED' as const },
    ];
    expect(onboardingMissing(company(docs, ['PENDING']))).toEqual(['Ticaret sicil gazetesi / faaliyet belgesi']);
    expect(onboardingMissing(company([...docs, { type: 'TRADE_REGISTRY', status: 'PENDING' }], ['REJECTED']))).toEqual([
      'Araç (ruhsat ve plakalı fotoğraflar)',
    ]);
  });

  it('her şey yüklüyse ya da firma onaylı/reddedilmişse firmanın yapacağı bir şey yok', () => {
    const all = (['K3_LICENSE', 'TAX_CERTIFICATE', 'TRADE_REGISTRY'] as const).map((type) => ({ type, status: 'PENDING' as const }));
    expect(onboardingMissing(company(all, ['PENDING']))).toBeNull();
    expect(onboardingMissing(company([], [], 'VERIFIED'))).toBeNull();
    expect(onboardingMissing(company([], [], 'REJECTED'))).toBeNull();
  });

  it('hatırlatma sayacı son ilerlemeden başlar', () => {
    const d = (day: number) => new Date(`2026-11-0${day}T09:00:00Z`);
    expect(lastOnboardingProgress({ createdAt: d(1), company: null })).toEqual(d(1));
    expect(
      lastOnboardingProgress({ createdAt: d(1), company: { createdAt: d(2), documents: [{ createdAt: d(4) }], vehicles: [{ createdAt: d(3) }] } }),
    ).toEqual(d(4));
  });
});
