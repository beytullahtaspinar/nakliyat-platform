import type { Metadata } from "next";
import { apiFetch } from "@/lib/api";

/** Doğrulama kodları değişince ana sayfa bu etiketle hemen yenilenir */
export const SITE_SETTINGS_CACHE_TAG = "site-ayarlari";

/** Arama motoru doğrulama kodları (GET /site-settings); kod herkese açıktır, ana sayfada meta etiketi olur */
export type SearchVerification = { google: string | null; bing: string | null; yandex: string | null };

/** API'ye ulaşılamazsa (ör. derleme sırasında) kodsuz; sonraki yenilemede düzelir */
export async function loadSearchVerification(): Promise<SearchVerification> {
  try {
    const { verification } = await apiFetch<{ verification: SearchVerification }>("/site-settings", {
      revalidate: 3600,
      tags: [SITE_SETTINGS_CACHE_TAG],
    });
    return verification;
  } catch {
    return { google: null, bing: null, yandex: null };
  }
}

/** Next metadata.verification: google-site-verification, yandex-verification, msvalidate.01 (Bing) */
export function verificationMetadata(v: SearchVerification): Metadata["verification"] {
  return {
    ...(v.google && { google: v.google }),
    ...(v.yandex && { yandex: v.yandex }),
    ...(v.bing && { other: { "msvalidate.01": v.bing } }),
  };
}
