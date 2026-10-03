import type { LocalPage } from "@nakliyat/locations";
import { apiFetch, type Paginated, type PublicCompanyListItem } from "@/lib/api";
import { COMPANY_CACHE_TAG } from "@/lib/reviews";

/** İl/ilçe/güzergâh sayfasında gösterilen en fazla firma */
export const LOCAL_COMPANY_LIMIT = 8;

/**
 * Doğrulanmış tüm firmalar, tek istekle (derlemede yüzlerce il/ilçe sayfası aynı yanıtı paylaşır).
 * Firma tanıtımı ya da yorumu değişince 'firmalar' etiketiyle hemen yenilenir. API'ye ulaşılamazsa boş.
 */
async function allCompanies(): Promise<PublicCompanyListItem[]> {
  try {
    const { items } = await apiFetch<Paginated<PublicCompanyListItem>>("/companies?limit=1000", {
      revalidate: 3600,
      tags: [COMPANY_CACHE_TAG],
    });
    return items;
  } catch {
    return [];
  }
}

/**
 * Sayfanın bölgesinde hizmet veren firmalar (API sırası: çok yorum alan, yüksek puanlı, tanıtımı dolu önce).
 * Güzergâh sayfasında iki ile de hizmet verenler.
 */
export async function getLocalCompanies(page: LocalPage) {
  const codes = page.kind === "route" ? [page.from.code, page.to.code] : [page.city.code];
  const serving = (await allCompanies()).filter((c) => codes.every((code) => c.serviceCityCodes?.includes(code)));
  return { items: serving.slice(0, LOCAL_COMPANY_LIMIT), total: serving.length };
}
