/** Logo kutusu boyutları: logo 192 px WebP olarak saklanır, en büyük kutu 96 px (2x ekranda net) */
const SIZES = {
  sm: { px: 40, box: "h-10 w-10 rounded-lg p-0.5", text: "text-base" },
  md: { px: 48, box: "h-12 w-12 rounded-lg p-0.5", text: "text-lg" },
  xl: { px: 96, box: "h-20 w-20 rounded-2xl p-1.5 sm:h-24 sm:w-24", text: "text-3xl sm:text-4xl" },
} as const;

/**
 * Firma logosu; logo yoksa (ya da yönetim gizlediyse) adının baş harfi marka renginde gösterilir.
 * `alt` boşsa görsel süs sayılır (yanında firma adı zaten yazıyorsa).
 */
export function CompanyLogo({
  name,
  logoUrl,
  size = "md",
  alt = "",
  priority = false,
  className = "",
}: {
  name: string;
  logoUrl: string | null;
  size?: keyof typeof SIZES;
  alt?: string;
  /** Sayfanın üstündeyse tembel yüklenmez */
  priority?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tarayıcıda küçültülmüş 192 px WebP, kalıcı adres
      <img
        src={logoUrl}
        alt={alt}
        width={s.px}
        height={s.px}
        loading={priority ? undefined : "lazy"}
        decoding="async"
        className={`${s.box} block shrink-0 border border-zinc-200 bg-white object-contain ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${s.box} flex shrink-0 items-center justify-center bg-gradient-to-br from-brand-700 to-brand-900 font-bold text-white ${s.text} ${className}`}
    >
      {name.trim().slice(0, 1).toLocaleUpperCase("tr-TR")}
    </span>
  );
}
