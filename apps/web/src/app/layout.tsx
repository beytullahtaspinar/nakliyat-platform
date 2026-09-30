import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { JsonLd } from "@/components/json-ld";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <JsonLd data={organizationJsonLd} />
        {children}
      </body>
    </html>
  );
}
