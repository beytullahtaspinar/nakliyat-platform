import type { NextConfig } from "next";

/**
 * Tüm sayfalara güvenlik başlıkları. Tam CSP yok (Next satır içi betikleri ve PageSpeed puanı); başka sitenin
 * sayfamızı çerçeve içinde göstermesi (tıklama tuzağı) frame-ancestors ile engellenir.
 */
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Kamera, mikrofon ve ödeme API'leri kullanılmıyor; konum yalnızca sitenin kendisine açık
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },
];

const nextConfig: NextConfig = {
  // "X-Powered-By: Next.js" başlığı saldırgana sürüm araştırması için ipucu vermesin
  poweredByHeader: false,
  // cPanel "Setup Node.js App" için tek klasörlük, bağımlılıkları içinde çalıştırılabilir çıktı
  output: "standalone",
  // Sunucuda birden çok Node süreci var: yönetimde yapılan güncelleme hepsinin önbelleğini yenilesin
  cacheHandler: require.resolve("./cache-handler.cjs"),
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
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
