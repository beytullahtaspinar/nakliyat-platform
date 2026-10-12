/* eslint-disable @next/next/no-img-element -- küçük, sabit marka görselleri; boyutları srcSet ile hazır (public/marka/) */

/**
 * Marka logosu: Beytullah'ın hazırladığı dosyalar (2026-10-12). Turuncu "e" + "evden eve Nakliyat" yazısı.
 * Açık zeminde lacivert yazılı (`logo-*.webp`), koyu zeminde beyaz yazılı (`logo-beyaz-*.webp`) yatay sürüm.
 * Kaynak PNG'ler ve simge üretimi: /mnt/project-files/tasarim/logo/hazir-2026-10-12/.
 * Oran 803×108 (≈7.44:1); width/height verildiği için yüklenirken yer kayması olmaz.
 */
const LOGO_RATIO = 803 / 108;

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
 * Yatay logo. Erişilebilir ad logoyu saran bağlantıdan (aria-label) ya da yanındaki metinden gelir, görsel boş alt'lıdır.
 * `compactBelow360`: çok dar telefonlarda (320 px) yalnızca "e"; başlıktaki düğmelere yer kalsın.
 * `inverse`: koyu (lacivert) zemin için beyaz yazılı sürüm.
 */
export function Logo({ compactBelow360 = false, inverse = false }: { compactBelow360?: boolean; inverse?: boolean }) {
  const name = inverse ? "logo-beyaz" : "logo";
  const img = (
    <img
      src={`/marka/${name}-400.webp`}
      srcSet={`/marka/${name}-400.webp 400w, /marka/${name}-800.webp 803w`}
      sizes="(min-width: 640px) 268px, 193px"
      width={Math.round(36 * LOGO_RATIO)}
      height={36}
      alt=""
      decoding="async"
      className="block h-[26px] w-auto max-[359px]:h-8 sm:h-9"
    />
  );
  if (!compactBelow360) return img;
  // <picture>: dar ekranda yalnızca "e" indirilir, yatay logo hiç yüklenmez (ve tersi)
  return (
    <picture>
      <source media="(max-width: 359px)" srcSet="/marka/e.webp" width={192} height={132} />
      {img}
    </picture>
  );
}
