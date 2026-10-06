import Link from "next/link";
import { citySlug } from "@nakliyat/locations";
import { LogoMark } from "@/components/ui/logo";
import { LEGAL_LINKS } from "@/lib/legal";
import { HUB_PATH } from "@/lib/local-content";
import { LAUNCH_CITIES } from "@/lib/local-seo";
import { COMPANY_SIGNUP_PATH, MARKETING_PAGES } from "@/lib/marketing";

const COLUMNS = [
  {
    title: "Taşınacaklar için",
    links: [
      { href: "/talep-olustur", label: "Ücretsiz teklif al" },
      MARKETING_PAGES.howItWorks,
      { href: MARKETING_PAGES.priceCalculator.href, label: "Nakliyat fiyat hesaplama" },
      { href: HUB_PATH, label: "81 ilde nakliyat" },
      { href: "/giris", label: "Giriş yap" },
      { href: "/blog", label: "Taşınma rehberi (blog)" },
    ],
  },
  {
    title: "Nakliyat firmaları için",
    links: [
      { href: MARKETING_PAGES.forCompanies.href, label: "Neden katılmalı?" },
      { href: COMPANY_SIGNUP_PATH, label: "Firma olarak katıl" },
      { href: "/giris?next=/firma-paneli", label: "Firma paneli" },
    ],
  },
  {
    title: "Popüler iller",
    links: LAUNCH_CITIES.map((c) => ({ href: `/${citySlug(c)}`, label: `${c.name} evden eve nakliyat` })),
  },
];

/**
 * Panel sayfalarında (müşteri hesabı, doğrulama: `<main data-panel>`) yalnızca alt satır
 * (telif + yasal metinler) görünür; tanıtım sütunları gizlenir (globals.css, JS gerektirmez).
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="site-footer-columns mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-display font-bold text-zinc-900 dark:text-white">evdenevenakliyat.app</span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-zinc-600 dark:text-zinc-400">
            Türkiye genelinde evden eve ve şehirler arası nakliyat için K3 belgeli, doğrulanmış
            firmalardan teklif alıp karşılaştırabileceğin platform.
          </p>
          <Link
            href={MARKETING_PAGES.about.href}
            className="mt-3 inline-block py-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
          >
            Hakkımızda
          </Link>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{col.title}</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-zinc-600 dark:text-zinc-400">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-brand-700 dark:hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="site-footer-columns-divider border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} evdenevenakliyat.app</p>
          <nav aria-label="Yasal metinler">
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  {/* py-1.5: dokunma hedefi en az 24 px (PageSpeed/WCAG 2.5.8) */}
                  <Link href={link.href} className="inline-block py-1.5 hover:text-brand-700 hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
