/** Türkiye saati sabit UTC+3 (2016'dan beri yaz saati yok) */
export const TR_OFFSET_MS = 3 * 3_600_000;
const DAY_MS = 86_400_000;

export const STATS_PERIODS = [7, 30, 90] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

/**
 * Bugünü de içeren son `days` gün (Türkiye saatiyle gün başından) ve hemen önceki eşit uzunluktaki dönem.
 * `days` = 7 ise bugün + önceki 6 gün.
 */
export function statsRange(days: number, now = new Date()) {
  const todayStartTr = Math.floor((now.getTime() + TR_OFFSET_MS) / DAY_MS) * DAY_MS - TR_OFFSET_MS;
  const from = new Date(todayStartTr - (days - 1) * DAY_MS);
  const previousFrom = new Date(from.getTime() - days * DAY_MS);
  return { from, to: now, previousFrom };
}

/** Türkiye saatiyle gün anahtarı: "2026-10-03" */
export const trDayKey = (date: Date) => new Date(date.getTime() + TR_OFFSET_MS).toISOString().slice(0, 10);

/** Dönemdeki her gün için bir satır; verisi olmayan günler 0 */
export function fillDays(from: Date, days: number, rows: { day: string; count: number }[]) {
  const byDay = new Map(rows.map((r) => [r.day, r.count]));
  return Array.from({ length: days }, (_, i) => {
    const day = trDayKey(new Date(from.getTime() + i * DAY_MS));
    return { day, count: byDay.get(day) ?? 0 };
  });
}

/** Paydası 0 olan oranlarda null (ekranda "—") */
export const ratio = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 1000 : null);
