import { SITE_URL } from "@/lib/site";

/**
 * Mağazadaki mobil uygulamalar (apps/mobile, APP_VARIANT=musteri|firma).
 * App Store bağlantısı Türkiye mağazasına (/tr/) gider; paket kimlikleri yayından sonra değişmez.
 */
export type MobileAppKind = "musteri" | "firma";

export type MobileApp = {
  kind: MobileAppKind;
  name: string;
  /** Rozetlerin yanındaki kısa açıklama ve erişilebilir ad */
  audience: string;
  androidPackage: string;
  iosAppId: string;
  playUrl: string;
  appStoreUrl: string;
};

export const MOBILE_APPS: Record<MobileAppKind, MobileApp> = {
  musteri: {
    kind: "musteri",
    name: "Evden Eve Nakliyat",
    audience: "Taşınacaklar için",
    androidPackage: "app.evdenevenakliyat.musteri",
    iosAppId: "6821929870",
    playUrl: "https://play.google.com/store/apps/details?id=app.evdenevenakliyat.musteri",
    appStoreUrl: "https://apps.apple.com/tr/app/evden-eve-nakliyat-app/id6821929870",
  },
  firma: {
    kind: "firma",
    name: "Evden Eve Nakliyat Firma",
    audience: "Nakliyat firmaları için",
    androidPackage: "app.evdenevenakliyat.firma",
    iosAppId: "6821928977",
    playUrl: "https://play.google.com/store/apps/details?id=app.evdenevenakliyat.firma",
    appStoreUrl: "https://apps.apple.com/tr/app/evden-eve-nakliyat-firma/id6821928977",
  },
};

/** iPhone Safari'de sayfanın üstünde "Aç / İndir" şeridi (Smart App Banner): Next `metadata.itunes` */
export const itunesMeta = (kind: MobileAppKind) => ({ appId: MOBILE_APPS[kind].iosAppId });

/**
 * Yapısal veri (schema.org MobileApplication). Ücretsiz uygulama; puan alanı mağazada yorum birikince
 * eklenebilir. Yayıncı sitedeki Organization düğümüdür ((site)/layout.tsx).
 */
export function mobileAppJsonLd(kind: MobileAppKind) {
  const app = MOBILE_APPS[kind];
  return {
    "@context": "https://schema.org",
    "@type": "MobileApplication",
    "@id": `${SITE_URL}/#uygulama-${kind}`,
    name: app.name,
    operatingSystem: "Android, iOS",
    applicationCategory: "LifestyleApplication",
    inLanguage: "tr-TR",
    description:
      kind === "musteri"
        ? "Taşınma talebi oluştur, doğrulanmış nakliyat firmalarının tekliflerini karşılaştır, firmayla mesajlaş ve taşınmanı takip et."
        : "Nakliyat firmaları için: bölgendeki taşınma taleplerini anında gör, teklif ver, işlerini ve müşterilerini yönet.",
    url: app.playUrl,
    downloadUrl: [app.playUrl, app.appStoreUrl],
    installUrl: app.playUrl,
    sameAs: [app.playUrl, app.appStoreUrl],
    offers: { "@type": "Offer", price: "0", priceCurrency: "TRY" },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}
