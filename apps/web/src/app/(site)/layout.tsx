import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { COMPANY } from "@/lib/legal";
import { BRAND_SLOGAN, BRAND_TAGLINE, SITE_NAME, SITE_URL } from "@/lib/site";

/** Herkese açık site: üst menü ve altbilgi. Müşteri hesabı, firma paneli ve yönetim kendi panel kabuklarında. */
const organizationJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    // Google arama sonucunda marka simgesi olarak kullanır: kare, en az 112 px
    logo: { "@type": "ImageObject", url: `${SITE_URL}/simgeler/simge-512.png`, width: 512, height: 512 },
    // Yalnızca platformun kendi destek adresi; firma iletişim bilgisi yapısal veriye konmaz
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: COMPANY.supportEmail,
      areaServed: "TR",
      availableLanguage: "Turkish",
    },
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
