import type { LocalPage } from "@nakliyat/locations";
import { apiFetch } from "@/lib/api";

/** Bölgeye ait gerçek platform verisi (GET /pricing/regions/:from/:to). GEO'da kaynak gösterilmemizi sağlayacak asıl içerik. */
export interface LocalStats {
  fromCityCode: string;
  toCityCode: string;
  days: number;
  requestCount: number;
  quoteCount: number;
  verifiedCompanyCount: number;
  /** Ev tipine göre tekliflerin ortadaki yarısı ve ortancası (TL); yeterli teklif ve firma olan tipler */
  priceRanges: { homeType: string; quoteCount: number; companyCount: number; p25: number; median: number; p75: number }[];
  updatedAt: string;
}

/**
 * İl ve ilçe sayfası il içi taşımaların, güzergâh sayfası iki il arası taşımaların verisini gösterir.
 * Gösterilecek satır yoksa ya da API'ye ulaşılamazsa null: sayfada uydurma rakam gösterilmez, bölüm hiç çizilmez.
 */
export async function getLocalStats(page: LocalPage): Promise<LocalStats | null> {
  const [from, to] = page.kind === "route" ? [page.from, page.to] : [page.city, page.city];
  try {
    const stats = await apiFetch<LocalStats>(`/pricing/regions/${from.code}/${to.code}`, { revalidate: 3600 });
    return stats.priceRanges.length ? stats : null;
  } catch {
    return null;
  }
}
