export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://evdenevenakliyat.app";
export const SITE_NAME = "evdenevenakliyat.app";

/** Marka sloganları (kullanıcı onaylı, 2026-10-06): başlıklar, meta açıklamalar ve tanıtım yerlerinde aynı sözler kullanılır */
export const BRAND_SLOGAN = "Evden Eve Taşınmanın Yeni Yolu";
export const BRAND_TAGLINE = "Tek Talep. Çok Teklif. Doğru Seçim.";
export const BRAND_PROMISE = "Taşınmak artık daha kolay.";

/** Ana sayfa ve varsayılan meta açıklaması (arama sonucunda ~155 karakter görünür) */
export const SITE_DESCRIPTION =
  "Tek talep, çok teklif, doğru seçim. Taşınma bilgilerini bir kez gir, K3 belgeli nakliyat firmalarının tekliflerini karşılaştır, sana uygun olanı seç.";

/**
 * Paylaşım görseli (app/opengraph-image.png). Kökte dosya kuralıyla eklenir; kendi `openGraph`
 * nesnesini veren sayfalar onu tümden değiştirdiği için bu listeyi açıkça vermeli.
 */
export const DEFAULT_OG_IMAGES = [
  {
    url: "/opengraph-image.png",
    width: 1200,
    height: 630,
    alt: `evdenevenakliyat.app: ${BRAND_SLOGAN}. ${BRAND_TAGLINE}`,
  },
];

/** Arama motorlarına ve yapay zekâ tarayıcılarına kapalı tutulan panel yolları */
export const PRIVATE_PATHS = ["/hesabim", "/firma-paneli", "/yonetim", "/giris", "/kayit", "/api/", "/uygulama"];
