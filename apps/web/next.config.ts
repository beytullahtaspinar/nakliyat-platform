import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cPanel "Setup Node.js App" için tek klasörlük, bağımlılıkları içinde çalıştırılabilir çıktı
  output: "standalone",
};

export default nextConfig;
