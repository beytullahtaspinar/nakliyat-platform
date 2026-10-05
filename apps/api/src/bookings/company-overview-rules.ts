import { addDays } from './calendar-rules.js';

/** Kazanma oranı için bakılan dönem (gün) */
export const WIN_RATE_DAYS = 90;

/** "2026-10-05" → ayın ilk günü ve sonraki ayın ilk günü ("2026-10-01", "2026-11-01") */
export function monthRange(day: string) {
  const first = `${day.slice(0, 7)}-01`;
  // 28. günden 4 gün sonrası her zaman sonraki aydadır
  const next = `${addDays(`${day.slice(0, 7)}-28`, 4).slice(0, 7)}-01`;
  return { first, next };
}

/**
 * Sonuçlanan tekliflerde kabul oranı (0-1, binde bir hassasiyet). Bekleyen ve geri çekilen teklifler sayılmaz;
 * sonuçlanan teklif yoksa null (ekranda "—").
 */
export function winRate(counts: Partial<Record<'ACCEPTED' | 'REJECTED' | 'EXPIRED' | string, number>>) {
  const accepted = counts.ACCEPTED ?? 0;
  const decided = accepted + (counts.REJECTED ?? 0) + (counts.EXPIRED ?? 0);
  return decided > 0 ? Math.round((accepted / decided) * 1000) / 1000 : null;
}
