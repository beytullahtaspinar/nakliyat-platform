import type { MetadataRoute } from "next";

/**
 * Telefona "uygulama gibi" kurulum (PWA). Ana ekrandan açılınca tarayıcı çubuğu olmadan,
 * /uygulama üzerinden kişinin kendi paneline (firma paneli, hesabım) gider.
 * Simgeler: public/simgeler/ (kaynak: app/icon.svg).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Evden Eve Nakliyat",
    short_name: "Nakliyat",
    description: "Taşınma talepleri, teklifler ve mesajlar; yeni iş geldiğinde anında bildirim.",
    lang: "tr",
    dir: "ltr",
    start_url: "/uygulama",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["business", "productivity"],
    icons: [
      { src: "/simgeler/simge-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/simgeler/simge-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/simgeler/simge-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Firma paneli", url: "/firma-paneli", icons: [{ src: "/simgeler/simge-192.png", sizes: "192x192" }] },
      { name: "Taleplerim", url: "/hesabim", icons: [{ src: "/simgeler/simge-192.png", sizes: "192x192" }] },
    ],
  };
}
