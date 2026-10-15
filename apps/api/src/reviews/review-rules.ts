import { todayInTurkey } from '../media/company-document-rules.js';

/** Yorum metni sınırları (boş bırakılabilir, yalnızca puan verilebilir) */
export const COMMENT_MIN_LENGTH = 10;
export const COMMENT_MAX_LENGTH = 2000;
export const REPLY_MAX_LENGTH = 1000;

/**
 * Taşınma günü geldi mi? İş, planlanan günden önce tamamlandı sayılamaz; böylece taşınmadan
 * önce yorum yazılamaz. Gün Türkiye saatine göre hesaplanır (taşınma tarihi gün olarak saklanır).
 */
export const moveDayReached = (scheduledAt: Date, now = new Date()) =>
  todayInTurkey(now) >= scheduledAt.toISOString().slice(0, 10);

/**
 * Taşınma günü geçti mi? Anlaşılan iş taşınma gününün sonuna kadar iptal edilebilir; sonrasında
 * iş ya tamamlanır ya da yönetime bildirilir (firma kötü yorumdan kaçmak için geriye dönük iptal edemez).
 */
export const moveDayPassed = (scheduledAt: Date, now = new Date()) =>
  todayInTurkey(now) > scheduledAt.toISOString().slice(0, 10);

/** Taşınma gününden bu kadar gün sonra kimse işaretlemediyse ve itiraz yoksa iş kendiliğinden tamamlanır */
export const AUTO_COMPLETE_DAYS = 7;
/** Taşınma sonrası bildirimler (ertesi gün kontrolü, otomatik tamamlama) bu saatten (Türkiye saati) itibaren gider */
export const FOLLOW_UP_HOUR_TR = 10;

const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00.000Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** İşin kendiliğinden tamamlanacağı gün ("2026-10-22"); taşınma günü + AUTO_COMPLETE_DAYS */
export const autoCompleteDay = (scheduledAt: Date) => addDays(scheduledAt.toISOString().slice(0, 10), AUTO_COMPLETE_DAYS);

/**
 * Taşınma sonrası işinin bu turda bakacağı günler; saat FOLLOW_UP_HOUR_TR'den önceyse null (gece bildirim gitmesin).
 * - checkFrom..checkTo: taşınma günü dün ile (AUTO_COMPLETE_DAYS-1) gün önce arası → "taşınma tamamlandı mı?" sorusu
 * - completeBefore: taşınma günü bu günden önce olanlar (en az AUTO_COMPLETE_DAYS gün geçmiş) → kendiliğinden tamamlanır
 */
export function followUpWindow(now = new Date()) {
  const hourTr = (now.getUTCHours() + 3) % 24;
  if (hourTr < FOLLOW_UP_HOUR_TR) return null;
  const today = todayInTurkey(now);
  const completeBefore = addDays(today, -(AUTO_COMPLETE_DAYS - 1));
  return { checkFrom: completeBefore, checkTo: today, completeBefore };
}

/**
 * Herkese açık sayfada yorum sahibinin adı: "Ayşe Yılmaz" → "Ayşe Y.". Soyadı ve iletişim
 * bilgisi gösterilmez; hesabını silen müşterinin adı hiç gösterilmez.
 */
export function maskName(fullName: string, deleted: boolean): string {
  if (deleted) return 'Müşteri';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Müşteri';
  const [first, ...rest] = parts;
  const last = rest.at(-1);
  return last ? `${first} ${last.charAt(0).toLocaleUpperCase('tr-TR')}.` : first!;
}

/**
 * Müşteri yorumunu firmanın yanıtından sonra düzenlediyse yanıt eski metne aittir; firma yanıtını
 * bir kez daha güncelleyebilir (her yeni düzenlemeden sonra yeniden).
 */
export const replyOutdated = (r: { companyReplyAt: Date | null; editedAt: Date | null }) =>
  !!(r.companyReplyAt && r.editedAt && r.editedAt > r.companyReplyAt);
