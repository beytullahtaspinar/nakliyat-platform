import type { Prisma } from '../generated/prisma/client.js';
import { CompanyDocumentType, UserRole, VerificationStatus } from '../generated/prisma/enums.js';
import { DOCUMENT_LABELS, REQUIRED_DOCUMENT_TYPES } from '../media/company-document-rules.js';

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
 * createdAt: sayacın başladığı an (bkz. lastOnboardingProgress). Birkaç adım birden geçmişse
 * (ör. sunucu kapalıydı) yalnızca sonuncusu gönderilir.
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

/** Hiç firma bilgisi girilmemiş hesabın eksiği */
export const MISSING_PROFILE_LABEL = 'Firma bilgileri';
export const MISSING_VEHICLE_LABEL = 'Araç (ruhsat ve plakalı fotoğraflar)';

type OnboardingCompany = {
  verificationStatus: VerificationStatus;
  documents: { type: CompanyDocumentType; status: VerificationStatus }[];
  vehicles: { status: VerificationStatus }[];
} | null;

/**
 * Firmanın kendisinin yapması gereken eksikler; firmanın yapacağı bir şey yoksa null.
 * Yüklenip incelemede olan belge ve araç eksik sayılmaz (sıra yönetimde); reddedilen sayılır.
 * Onaylanmış ya da reddedilmiş firmalar için null (onların kendi bildirimleri var).
 */
export function onboardingMissing(company: OnboardingCompany): string[] | null {
  if (!company) return [MISSING_PROFILE_LABEL];
  if (company.verificationStatus !== VerificationStatus.PENDING) return null;
  const alive = (s: VerificationStatus) => s !== VerificationStatus.REJECTED;
  const missing = REQUIRED_DOCUMENT_TYPES.filter((type) => !company.documents.some((d) => d.type === type && alive(d.status))).map(
    (type) => DOCUMENT_LABELS[type],
  );
  if (!company.vehicles.some((v) => alive(v.status))) missing.push(MISSING_VEHICLE_LABEL);
  return missing.length ? missing : null;
}

/** onboardingMissing'in veritabanı karşılığı: firma bilgisi ya da yüklenmesi gereken belge/aracı eksik firma hesapları */
export const onboardingIncompleteWhere = (): Prisma.UserWhereInput => ({
  role: UserRole.COMPANY,
  deletedAt: null,
  OR: [
    { company: { is: null } },
    {
      company: {
        is: {
          deletedAt: null,
          verificationStatus: VerificationStatus.PENDING,
          OR: [
            ...REQUIRED_DOCUMENT_TYPES.map((type) => ({
              documents: { none: { type, status: { not: VerificationStatus.REJECTED } } },
            })),
            { vehicles: { none: { status: { not: VerificationStatus.REJECTED } } } },
          ],
        },
      },
    },
  ],
});

/** Eksiklerin hesaplanması için firma alanları (onboardingMissing ile birlikte) */
export const ONBOARDING_COMPANY_SELECT = {
  verificationStatus: true,
  createdAt: true,
  documents: { select: { type: true, status: true, createdAt: true } },
  vehicles: { select: { status: true, createdAt: true } },
} satisfies Prisma.CompanySelect;

/**
 * Hatırlatma sayacının başladığı an: kayıt, firma bilgisi, son belge ya da araç yüklemesi.
 * Firma ilerleme kaydettikçe hatırlatmalar yeniden 1. ve 3. günde gider.
 */
export function lastOnboardingProgress(user: {
  createdAt: Date;
  company: { createdAt: Date; documents: { createdAt: Date }[]; vehicles: { createdAt: Date }[] } | null;
}): Date {
  const times = [user.createdAt.getTime()];
  if (user.company) {
    times.push(user.company.createdAt.getTime());
    for (const d of user.company.documents) times.push(d.createdAt.getTime());
    for (const v of user.company.vehicles) times.push(v.createdAt.getTime());
  }
  return new Date(Math.max(...times));
}
