import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { BRAND_SLOGAN, BRAND_TAGLINE, SITE_NAME, SITE_URL } from "@/lib/site";

/** Herkese açık site ve müşteri/firma panelleri: üst menü ve altbilgi. Yönetim paneli bu düzenin dışında. */
const organizationJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    slogan: `${BRAND_SLOGAN}. ${BRAND_TAGLINE}`,
    description:
      "Türkiye genelinde evden eve ve şehirler arası nakliyat için doğrulanmış firma, fiyat ve taşınma rehberi platformu.",
    areaServed: { "@type": "Country", name: "Türkiye" },
    knowsAbout: [
      "Evden eve nakliyat",
      "Şehirler arası nakliyat",
      "Nakliyat fiyatları",
      "K3 yetki belgesi",
      "Taşınma planlama",
    ],
    // Sosyal medya, Wikidata ve basın profilleri açıldıkça eklenecek (varlık/entity sinyali)
    sameAs: [],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "tr-TR",
    publisher: { "@id": `${SITE_URL}/#organization` },
  },
];

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={organizationJsonLd} />
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
