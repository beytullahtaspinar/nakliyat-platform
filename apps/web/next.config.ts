import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cPanel "Setup Node.js App" için tek klasörlük, bağımlılıkları içinde çalıştırılabilir çıktı
  output: "standalone",
  experimental: {
    // Tailwind CSS'i küçük; HTML içine gömülünce ilk ziyarette render'ı bloklayan istek kalkar (LCP)
    inlineCss: true,
  },
};

export default nextConfig;
