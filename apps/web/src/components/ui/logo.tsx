/** Marka işareti: kalın "e" ve turuncu nokta (".app" ve varış noktası). `app/icon.svg` ile aynı çizim. */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <rect width="32" height="32" rx="8" className="fill-brand-700" />
      <path
        d="M9.2 16.2h12.6a6.4 6.4 0 1 0-1.9 4.6"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24.6" cy="22.4" r="2.4" className="fill-accent-500" />
    </svg>
  );
}

/** `compactBelow360`: çok dar telefonlarda (320 px) yalnızca işaret; başlıktaki düğmelere yer kalsın */
export function Logo({ compactBelow360 = false }: { compactBelow360?: boolean }) {
  return (
    <span className="flex items-center gap-2 sm:gap-2.5">
      <LogoMark />
      <span className={`${compactBelow360 ? "max-[359px]:hidden " : ""}font-display text-[0.9rem] font-bold tracking-tight text-zinc-900 sm:text-[1.05rem] dark:text-white`}>
        evdenevenakliyat<span className="text-accent-700 dark:text-accent-400">.app</span>
      </span>
    </span>
  );
}
