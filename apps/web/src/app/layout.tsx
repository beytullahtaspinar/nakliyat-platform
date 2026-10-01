import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// Tek yazı tipi ailesi: indirilen font dosyası az olsun, ilk boyama (LCP) gecikmesin.
// Inter, Türkçe karakterlerde (ı, ş, ğ) aralıkları düzgün çizdiği için seçildi.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  // Font ilk boyamaya yetişmezse o sayfa boyutu eşlenmiş sistem fontuyla kalır: sonradan
  // font değişip içerik kaymaz (CLS) ve LCP fonta takılmaz. Sonraki ziyarette Inter önbellekten gelir.
  display: "optional",
});

// Koyu mod yok: tarayıcı arayüzü ve form denetimleri de açık temada kalsın
export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

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
      className={`${inter.variable} h-full antialiased`}
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
