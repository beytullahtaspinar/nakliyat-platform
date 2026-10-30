import { DEFAULT_PRICING_SETTINGS } from "@nakliyat/pricing";
import { apiFetch } from "@/lib/api";
import { PRICING_CACHE_TAG, type PricingModel } from "@/lib/pricing";

/**
 * Fiyat katsayıları (sunucuda). Bir saat önbellekte kalır; yönetimden değişince 'fiyat' etiketiyle hemen yenilenir.
 * API'ye ulaşılamazsa (ör. derleme sırasında) varsayılan katsayılar, sonraki yenilemede düzelir.
 */
export async function loadPricingModel(): Promise<PricingModel> {
  try {
    return await apiFetch<PricingModel>("/pricing", { revalidate: 3600, tags: [PRICING_CACHE_TAG] });
  } catch {
    return { settings: DEFAULT_PRICING_SETTINGS, calibration: {}, updatedAt: null };
  }
}
