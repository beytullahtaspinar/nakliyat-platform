import type { LocalPage } from "@nakliyat/locations";

/** Bölgeye ait gerçek platform verisi. GEO'da kaynak gösterilmemizi sağlayacak asıl içerik. */
export interface LocalStats {
  verifiedCompanyCount: number;
  quoteCount: number;
  /** Ev tipine göre son 90 günün teklif aralığı (TL) */
  priceRanges: { homeType: string; minTry: number; maxTry: number; sampleSize: number }[];
  updatedAt: string;
}

/**
 * Şimdilik veri yok: API'de istatistik uç noktası yazılınca buradan çekilecek.
 * Veri yokken sayfada uydurma rakam gösterilmez, ilgili bölüm hiç çizilmez.
 */
export async function getLocalStats(page: LocalPage): Promise<LocalStats | null> {
  void page;
  return null;
}
