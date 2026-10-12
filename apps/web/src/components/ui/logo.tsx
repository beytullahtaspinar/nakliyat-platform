/* eslint-disable @next/next/no-img-element -- küçük, sabit marka görselleri (public/marka/), optimize edilecek bir şey yok */

/**
 * Marka logosu: Beytullah'ın hazırladığı dosyalar (2026-10-12). Turuncu "e" + "evden eve Nakliyat" yazısı.
 * Yazı vektör: logo1.pdf (açık zemin, lacivert) ve logo2.pdf (koyu zemin, beyaz) içindeki yollar `public/marka/yazi*.svg`.
 * PDF'lerdeki "e" 281 px'lik bir görsel olduğu için "e" 1024 px PNG'den (`e.webp`). Kaynaklar ve betikler:
 * /mnt/project-files/tasarim/logo/hazir-2026-10-12/. Yazı SVG'si PDF'nin tüm alanını (669×96.7) kaplar, "e" PDF'deki
 * yerine (x 4.3–134.3, y 5.4–94.5) yüzdeyle oturtulur; böylece ikisi her boyutta birlikte ölçeklenir.
 */

/** Yalnızca "e" işareti (192×132) */
export function LogoMark({ className = "h-8 w-auto" }: { className?: string }) {
  return <img src="/marka/e.webp" width={192} height={132} alt="" className={className} decoding="async" />;
}

/** Uygulama simgesi: lacivert yuvarlak kare içinde "e" (panellerde, telefon simgesiyle aynı) */
export function LogoAppIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-[22%] bg-brand-700 ${className}`} aria-hidden>
      <LogoMark className="h-auto w-[80%]" />
    </span>
  );
}

/**
 * Yatay logo. Erişilebilir ad logoyu saran bağlantıdan (aria-label) ya da yanındaki metinden gelir, görseller boş alt'lıdır.
 * `compactBelow360`: çok dar telefonlarda (320 px) yalnızca "e"; başlıktaki düğmelere yer kalsın.
 * `inverse`: koyu (lacivert) zemin için beyaz yazılı sürüm.
 */
export function Logo({ compactBelow360 = false, inverse = false }: { compactBelow360?: boolean; inverse?: boolean }) {
  return (
    <span className="relative inline-flex">
      <img
        src={inverse ? "/marka/yazi-beyaz.svg" : "/marka/yazi.svg"}
        width={669}
        height={97}
        alt=""
        decoding="async"
        className={`block h-[26px] w-auto sm:h-9 ${compactBelow360 ? "max-[359px]:hidden" : ""}`}
      />
      <img
        src="/marka/e.webp"
        srcSet="/marka/e-96.webp 96w, /marka/e.webp 192w"
        sizes="(max-width: 359px) 47px, (min-width: 640px) 51px, 35px"
        width={192}
        height={132}
        alt=""
        decoding="async"
        className={`absolute top-[5.6%] left-[0.64%] h-[92.2%] w-auto ${compactBelow360 ? "max-[359px]:static max-[359px]:h-8" : ""}`}
      />
    </span>
  );
}
