/** Marka işareti: ev çatısı içinde koli. `app/icon.svg` ile aynı çizim. */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <rect width="32" height="32" rx="8" className="fill-brand-700" />
      <path
        d="M6.5 15 16 7.5l9.5 7.5M9.5 13v11h13V13"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="12.5" y="16.5" width="7" height="7.5" rx="1" className="fill-accent-500" />
      <path d="M16 16.5v3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 sm:gap-2.5">
      <LogoMark />
      <span className="font-display text-[0.9rem] font-bold tracking-tight text-zinc-900 sm:text-[1.05rem] dark:text-white">
        evdenevenakliyat<span className="text-accent-600 dark:text-accent-400">.app</span>
      </span>
    </span>
  );
}
