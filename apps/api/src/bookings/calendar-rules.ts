import { todayInTurkey } from '../media/company-document-rules.js';

const DAY_MS = 86_400_000;

/** "2026-10-04" → o günün UTC gece yarısı. Taşınma tarihi bu biçimde (gün olarak) saklanır. */
export const dayStart = (day: string) => new Date(`${day}T00:00:00.000Z`);
export const addDays = (day: string, days: number) =>
  new Date(dayStart(day).getTime() + days * DAY_MS).toISOString().slice(0, 10);

/** Hatırlatmalar taşınmadan bir gün önce bu saatten (Türkiye saati) itibaren gönderilir; gece yarısı bildirim gitmesin. */
export const REMINDER_HOUR_TR = 10;

/**
 * Şu an hatırlatma zamanıysa taşınma günü yarın olan işlerin günü ("2026-10-04"), değilse null.
 * Türkiye'de yaz saati yok (UTC+3), saat bu yüzden sabit fark ile hesaplanır.
 */
export function reminderDay(now = new Date()): string | null {
  const hourTr = (now.getUTCHours() + 3) % 24;
  if (hourTr < REMINDER_HOUR_TR) return null;
  return addDays(todayInTurkey(now), 1);
}

/** Takvimde bir seferde istenebilecek en uzun aralık (ay görünümü 6 hafta gösterir) */
export const MAX_CALENDAR_DAYS = 42;
