import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// Tek yazı tipi ailesi: indirilen font dosyası az olsun, ilk boyama (LCP) gecikmesin
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Evden Eve Nakliyat Teklifi Al | evdenevenakliyat.app",
    template: "%s | evdenevenakliyat.app",
  },
  description:
    "Taşınma bilgilerini bir kez gir, K3 belgeli doğrulanmış nakliyat firmalarından teklifleri karşılaştır, sana en uygun olanı seç.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "/",
    siteName: SITE_NAME,
  },
  robots: { index: true, follow: true },
};

const organizationJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${jakarta.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <JsonLd data={organizationJsonLd} />
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
