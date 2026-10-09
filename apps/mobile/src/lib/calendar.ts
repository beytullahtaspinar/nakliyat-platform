// Takvim gün hesapları; apps/web/src/lib/calendar.ts ile aynı. Günler "2026-10-04", Türkiye saatine göre.

const DAY_MS = 86_400_000;

export const todayInTurkey = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

export const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** Pazartesi 0 … Pazar 6 */
const weekdayIndex = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;

const weekStart = (day: string) => addDays(day, -weekdayIndex(day));

export const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
};

/** Ay görünümünün günleri: ilk haftanın pazartesisinden son haftanın pazarına (en çok 42 gün) */
export function monthGrid(month: string): string[] {
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const days: string[] = [];
  for (let d = weekStart(`${month}-01`); d <= addDays(weekStart(last), 6); d = addDays(d, 1)) days.push(d);
  return days;
}

export const WEEKDAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const monthTitle = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayTitle = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** "Ekim 2026" */
export const formatMonth = (month: string) => monthTitle.format(new Date(`${month}-01T00:00:00Z`));
/** "4 Ekim Pazar" */
export const formatDayTitle = (day: string) => dayTitle.format(new Date(`${day}T00:00:00Z`));
