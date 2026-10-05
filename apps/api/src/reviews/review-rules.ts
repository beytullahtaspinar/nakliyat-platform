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
