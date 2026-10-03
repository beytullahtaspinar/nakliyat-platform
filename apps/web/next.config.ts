import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cPanel "Setup Node.js App" için tek klasörlük, bağımlılıkları içinde çalıştırılabilir çıktı
  output: "standalone",
  async headers() {
    return [
      {
        // Servis işçisi her açılışta yeniden kontrol edilsin: güncelleme hemen yayılır
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  experimental: {
    // Tailwind CSS'i küçük; HTML içine gömülünce ilk ziyarette render'ı bloklayan istek kalkar (LCP)
    inlineCss: true,
  },
};

export default nextConfig;
