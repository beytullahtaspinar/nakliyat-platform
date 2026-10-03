import Link from "next/link";
import { AccountMenu, RequestCta } from "@/components/account-menu";
import { MobileMenu } from "@/components/mobile-menu";
import { NavLink } from "@/components/nav-link";
import { Logo } from "@/components/ui/logo";
import { HUB_PATH } from "@/lib/local-content";
import { MARKETING_PAGES } from "@/lib/marketing";

// wide: tablette (md) başlığa sığmaz, geniş ekranda (lg) görünür; telefon menüsünde her zaman var
const NAV = [
  MARKETING_PAGES.howItWorks,
  { ...MARKETING_PAGES.priceCalculator, wide: true },
  { href: HUB_PATH, label: "İller" },
  MARKETING_PAGES.forCompanies,
  { href: "/blog", label: "Blog" },
];

/**
 * Telefonda: logo, "Teklif al" ve menü düğmesi (bağlantılar ve hesap menüde). Hesap bağlantıları
 * sm'den, ana menü md'den itibaren başlıkta görünür.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="evdenevenakliyat.app ana sayfa">
          <Logo compactBelow360 />
        </Link>
        <nav aria-label="Ana menü" className="hidden items-center gap-6 text-sm font-medium text-zinc-600 md:flex dark:text-zinc-300">
          {NAV.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              className={`${"wide" in item ? "hidden lg:inline " : ""}whitespace-nowrap py-1 hover:text-brand-700 aria-[current=page]:text-brand-800 aria-[current=page]:underline aria-[current=page]:decoration-brand-600 aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-[6px] dark:hover:text-white`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2 whitespace-nowrap sm:gap-4">
          <div className="hidden sm:block">
            <AccountMenu />
          </div>
          <RequestCta />
          <MobileMenu links={NAV} />
        </div>
      </div>
    </header>
  );
}
