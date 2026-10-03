/**
 * Takvim için gün hesapları. Günler "2026-10-04" biçiminde, Türkiye saatine göredir
 * (taşınma tarihi API'de gün olarak saklanır).
 */

const DAY_MS = 86_400_000;

export const todayInTurkey = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });

export const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** Pazartesi 0 … Pazar 6 */
export const weekdayIndex = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;

/** Günün içinde bulunduğu haftanın pazartesisi */
export const weekStart = (day: string) => addDays(day, -weekdayIndex(day));

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** ?ay=2026-10 değeri geçerliyse kendisi, değilse bu ay */
export const parseMonth = (value: unknown, today: string) =>
  typeof value === "string" && MONTH.test(value) ? value : today.slice(0, 7);

/** ?hafta=2026-10-05 değeri geçerliyse o haftanın pazartesisi, değilse bu hafta */
export const parseWeek = (value: unknown, today: string) =>
  weekStart(typeof value === "string" && DAY.test(value) && !Number.isNaN(Date.parse(value)) ? value : today);

export const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
};

/** Ay görünümünün günleri: ayın ilk gününün haftasının pazartesisinden son gününün haftasının pazarına (en çok 42 gün) */
export function monthGrid(month: string): string[] {
  const first = `${month}-01`;
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const days: string[] = [];
  for (let d = weekStart(first); d <= addDays(weekStart(last), 6); d = addDays(d, 1)) days.push(d);
  return days;
}

export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

export const WEEKDAYS_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const monthTitle = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" });
const dayTitle = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const shortDay = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "UTC" });

/** "Ekim 2026" */
export const formatMonth = (month: string) => monthTitle.format(new Date(`${month}-01T00:00:00Z`));
/** "4 Ekim Pazar" */
export const formatDayTitle = (day: string) => dayTitle.format(new Date(`${day}T00:00:00Z`));
/** "4 Ekim" */
export const formatShortDay = (day: string) => shortDay.format(new Date(`${day}T00:00:00Z`));
