export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://evdenevenakliyat.app";
export const SITE_NAME = "evdenevenakliyat.app";

/**
 * Paylaşım görseli (app/opengraph-image.png). Kökte dosya kuralıyla eklenir; kendi `openGraph`
 * nesnesini veren sayfalar onu tümden değiştirdiği için bu listeyi açıkça vermeli.
 */
export const DEFAULT_OG_IMAGES = [
  {
    url: "/opengraph-image.png",
    width: 1200,
    height: 630,
    alt: "evdenevenakliyat.app: Evden eve taşınmada belgeli firmalardan teklif al",
  },
];

/** Arama motorlarına ve yapay zekâ tarayıcılarına kapalı tutulan panel yolları */
export const PRIVATE_PATHS = ["/hesabim", "/firma-paneli", "/yonetim", "/giris", "/kayit", "/api/", "/uygulama"];
