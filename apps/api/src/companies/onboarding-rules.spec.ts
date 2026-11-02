import { canRemindManually, dueOnboardingStep, isSendingHour } from './onboarding-rules.js';

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
