import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/pwa/service-worker";
import { BRAND_SLOGAN, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

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
    default: `${BRAND_SLOGAN} | ${SITE_NAME}`,
    template: "%s | evdenevenakliyat.app",
  },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "/",
    siteName: SITE_NAME,
  },
  robots: { index: true, follow: true },
  // iPhone'da "Ana Ekrana Ekle" ile kurulunca tam ekran uygulama gibi açılır
  applicationName: SITE_NAME,
  appleWebApp: { capable: true, title: "Nakliyat", statusBarStyle: "default" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
