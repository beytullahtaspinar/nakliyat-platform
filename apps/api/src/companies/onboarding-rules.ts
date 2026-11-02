/**
 * Kayıt olup firma profilini oluşturmayan firma hesaplarına giden hatırlatmaların kuralları.
 * Saatler Türkiye saatine göredir.
 */

/** Otomatik hatırlatmalar: kayıttan kaç gün sonra */
export const ONBOARDING_REMINDER_DAYS = [1, 3] as const;
/** Bundan eski hesaplara otomatik hatırlatma gitmez (eski deneme hesapları rahatsız edilmesin) */
export const ONBOARDING_MAX_AGE_DAYS = 10;
/** Yöneticinin elle gönderdiği hatırlatmadan sonra bu süre içinde yenisi gönderilmez (otomatik ya da elle) */
export const ONBOARDING_MIN_GAP_HOURS = 12;
/** Hatırlatmalar yalnızca bu saatler arasında gönderilir (gece anlık bildirim gitmesin) */
export const ONBOARDING_SEND_HOURS = { from: 9, to: 21 } as const;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const turkeyHour = (now: Date) =>
  Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Istanbul' }).format(now));

/** Şu an hatırlatma gönderilebilecek saat mi (TSİ 09:00-21:00) */
export const isSendingHour = (now: Date) => {
  const hour = turkeyHour(now);
  return hour >= ONBOARDING_SEND_HOURS.from && hour < ONBOARDING_SEND_HOURS.to;
};

/**
 * Gönderilmesi gereken hatırlatmanın sırası (1 ya da 2); gerekmiyorsa null.
 * Birkaç adım birden geçmişse (ör. sunucu kapalıydı) yalnızca sonuncusu gönderilir.
 */
export function dueOnboardingStep(
  user: { createdAt: Date; onboardingReminderStep: number; onboardingRemindedAt: Date | null },
  now: Date,
): number | null {
  const age = now.getTime() - user.createdAt.getTime();
  if (age > ONBOARDING_MAX_AGE_DAYS * DAY_MS) return null;
  if (user.onboardingRemindedAt && now.getTime() - user.onboardingRemindedAt.getTime() < ONBOARDING_MIN_GAP_HOURS * HOUR_MS) {
    return null;
  }
  let due = 0;
  ONBOARDING_REMINDER_DAYS.forEach((days, i) => {
    if (age >= days * DAY_MS) due = i + 1;
  });
  return due > user.onboardingReminderStep ? due : null;
}

/** Yönetici elle hatırlatma gönderebilir mi: son hatırlatmanın üzerinden yeterli süre geçti mi */
export const canRemindManually = (remindedAt: Date | null, now: Date) =>
  !remindedAt || now.getTime() - remindedAt.getTime() >= ONBOARDING_MIN_GAP_HOURS * HOUR_MS;
