import { useId } from "react";

/**
 * Marka kimliği panosu (2026-10-12): hız çizgili turuncu "e", yanında "EvdenEve" lacivert, "Nakliyat" turuncu.
 * Çizim `app/icon.svg`, `public/cevrimdisi.html` ve simge PNG'leri ile aynıdır; değişirse hepsi birlikte güncellenir.
 */
const E_PATH = "M23 25.1 L56.5 18 A18 15.5 0 1 0 54.5 31.5";

/** Yalnızca "e" işareti (kare değil, 64×44 oran) */
export function LogoMark({ className = "h-8 w-auto" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 44" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#ffa41f" />
          <stop offset="1" stopColor="#ff7600" />
        </linearGradient>
      </defs>
      <path d={E_PATH} transform="skewX(-10) translate(4 0)" fill="none" stroke={`url(#${id})`} strokeWidth="7.2" strokeLinejoin="round" />
      <g className="fill-accent-500">
        <rect x="12" y="17.2" width="13" height="3.4" rx="1.7" />
        <rect x="2" y="22.9" width="20" height="3.4" rx="1.7" />
        <rect x="9" y="28.6" width="12" height="3.4" rx="1.7" />
      </g>
    </svg>
  );
}

/** Uygulama simgesi: lacivert yuvarlak kare içinde "e" (panellerde, sekme simgesiyle aynı) */
export function LogoAppIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-[22%] bg-brand-700 ${className}`} aria-hidden>
      <LogoMark className="w-[78%]" />
    </span>
  );
}

/**
 * Yazı SVG içinde: logodaki turuncu yazı (#FF8A00, beyazda 2.4:1) bir marka adıdır; WCAG logolardan
 * kontrast istemez ama HTML metni olsaydı Lighthouse kontrast denetimi bunu hata sayardı. Erişilebilir ad,
 * logoyu saran bağlantının aria-label'ından gelir. textLength: Inter gelmeden (display: optional)
 * yedek yazı tipiyle de genişlik aynı kalır, başlık kaymaz.
 */
export function LogoWordmark({ className = "h-5 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 172 24" className={className} aria-hidden focusable="false">
      <text
        x="1"
        y="19"
        textLength="168"
        lengthAdjust="spacingAndGlyphs"
        fontFamily="var(--font-inter), Arial, sans-serif"
        fontSize="21"
        fontWeight="800"
        fontStyle="italic"
        letterSpacing="-0.4"
        className="fill-brand-700"
      >
        EvdenEve<tspan className="fill-accent-500">Nakliyat</tspan>
      </text>
    </svg>
  );
}

/** `compactBelow360`: çok dar telefonlarda (320 px) yalnızca işaret; başlıktaki düğmelere yer kalsın */
export function Logo({ compactBelow360 = false }: { compactBelow360?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <LogoMark className="h-8 w-auto sm:h-9" />
      <LogoWordmark className={`${compactBelow360 ? "max-[359px]:hidden " : ""}h-[1.15rem] w-auto sm:h-[1.35rem]`} />
    </span>
  );
}
