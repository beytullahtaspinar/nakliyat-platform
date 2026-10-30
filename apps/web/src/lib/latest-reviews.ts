import type { LocalPage } from "@nakliyat/locations";
import { apiFetch, type LatestReview } from "@/lib/api";
import { COMPANY_CACHE_TAG } from "@/lib/reviews";

/** Ana sayfada ve il sayfalarında gösterilen en fazla yorum */
export const LATEST_REVIEW_LIMIT = 3;
/** Ana sayfa bölümü bundan az yorumla çizilmez (tek yorumluk bölüm boş görünür) */
export const HOME_MIN_REVIEWS = 3;

/**
 * Sitedeki en yeni 50 yazılı yorum, tek istekle (yüzlerce il sayfası aynı yanıtı paylaşır).
 * Yorum eklenince/düzenlenince/gizlenince 'firmalar' etiketiyle hemen yenilenir. API'ye ulaşılamazsa boş.
 */
export async function getLatestReviews(): Promise<LatestReview[]> {
  try {
    const { items } = await apiFetch<{ items: LatestReview[] }>("/reviews/latest?limit=50", {
      revalidate: 3600,
      tags: [COMPANY_CACHE_TAG],
    });
    return items;
  } catch {
    return [];
  }
}

/** Sayfanın bölgesindeki taşımaların yorumları: il/ilçe sayfasında çıkışı ya da varışı o il, güzergâhta iki il */
export async function getLocalReviews(page: LocalPage) {
  const codes = page.kind === "route" ? [page.from.code, page.to.code] : [page.city.code];
  const local = (await getLatestReviews()).filter((r) => codes.every((code) => r.cityCodes.includes(code)));
  return local.slice(0, LATEST_REVIEW_LIMIT);
}

/** İl sayfasında puan gösterilir; Google'a yapısal veri olarak en az bu kadar değerlendirmeyle verilir */
export const CITY_RATING_SCHEMA_MIN = 3;

export type CityRating = { cityCode: string; count: number; average: number };

/**
 * İlin ortalama puanı: çıkışı ya da varışı o il olan, platform üzerinden yapılmış taşımaların yayındaki puanları.
 * 81 il sayfası tek yanıtı paylaşır. Değerlendirme yoksa ya da API'ye ulaşılamazsa null (uydurma puan gösterilmez).
 */
export async function getCityRating(cityCode: string): Promise<CityRating | null> {
  try {
    const { items } = await apiFetch<{ items: CityRating[] }>("/reviews/cities", {
      revalidate: 3600,
      tags: [COMPANY_CACHE_TAG],
    });
    return items.find((c) => c.cityCode === cityCode && c.count > 0) ?? null;
  } catch {
    return null;
  }
}
