import Link from "next/link";
import { citySlug, routeSlug } from "@nakliyat/locations";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { COMPANY, LEGAL_LINKS } from "@/lib/legal";
import { HUB_PATH } from "@/lib/local-content";
import { LAUNCH_CITIES } from "@/lib/local-seo";
import { COMPANY_SIGNUP_PATH, MARKETING_PAGES } from "@/lib/marketing";
import { BRAND_PROMISE, BRAND_SLOGAN, BRAND_TAGLINE, SITE_NAME } from "@/lib/site";

/**
 * Şehirler arası sayfalardan yalnızca dizine eklenenler (iki ucu da lansman ilinde olanlar) altbilgiye girer;
 * lansman listesi daralırsa bağlantı kendiliğinden düşer.
 */
const POPULAR_ROUTES = [
  ["istanbul", "ankara"],
  ["istanbul", "izmir"],
  ["istanbul", "antalya"],
  ["istanbul", "bursa"],
  ["ankara", "izmir"],
  ["ankara", "antalya"],
]
  .map(([from, to]) => [LAUNCH_CITIES.find((c) => c.slug === from), LAUNCH_CITIES.find((c) => c.slug === to)])
  .filter((pair): pair is [(typeof LAUNCH_CITIES)[number], (typeof LAUNCH_CITIES)[number]] => Boolean(pair[0] && pair[1]));

type FooterLink = { href: string; label: string };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Taşınacaklar için",
    links: [
      MARKETING_PAGES.howItWorks,
      { href: MARKETING_PAGES.priceCalculator.href, label: "Fiyat hesaplama" },
      { href: "/blog", label: "Taşınma rehberi" },
      { href: "/giris", label: "Giriş yap" },
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
    links: [
      ...LAUNCH_CITIES.map((c) => ({ href: `/${citySlug(c)}`, label: `${c.name} nakliyat` })),
      { href: HUB_PATH, label: "Tüm iller (81 il)" },
    ],
  },
  {
    title: "Şehirler arası",
    links: POPULAR_ROUTES.map(([from, to]) => ({ href: `/${routeSlug(from, to)}`, label: `${from.name} - ${to.name}` })),
  },
];

/**
 * Panel sayfalarında (müşteri hesabı, doğrulama: `<main data-panel>`) yalnızca alt satır
 * (telif + yasal metinler) görünür; tanıtım sütunları gizlenir (globals.css, JS gerektirmez).
 *
 * Yalnızca platformun kendi destek adresi gösterilir; firmalara ait doğrudan iletişim bilgisi altbilgiye girmez.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-zinc-50">
      {/* Marka çizgisi: lacivertten turuncuya (yalnız CSS, görsel yükü yok) */}
      <div aria-hidden className="site-footer-columns h-1 bg-gradient-to-r from-brand-700 to-accent-500" />
      <div className="site-footer-columns mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 sm:px-6 md:grid-cols-4 lg:grid-cols-[1.5fr_repeat(4,1fr)] lg:gap-x-8">
        <div className="col-span-2 md:col-span-4 lg:col-span-1">
          <p>
            <Logo full />
            <span className="sr-only">Evden Eve Nakliyat ({SITE_NAME})</span>
          </p>
          <p className="mt-4 max-w-xs text-sm font-semibold text-zinc-800">{BRAND_SLOGAN}</p>
          <p className="mt-1.5 max-w-xs text-sm text-zinc-600">
            {BRAND_TAGLINE} {BRAND_PROMISE}
          </p>
          <ButtonLink href="/talep-olustur" variant="accent" size="sm" className="mt-5">
            Ücretsiz teklif al
          </ButtonLink>
          <ul className="mt-5 space-y-1 text-sm text-zinc-600">
            <li>
              <Link href={MARKETING_PAGES.about.href} className="inline-block py-1 font-semibold text-brand-700 hover:underline">
                Hakkımızda
              </Link>
            </li>
            <li>
              Destek:{" "}
              <a href={`mailto:${COMPANY.supportEmail}`} className="inline-block py-1 text-brand-700 hover:underline">
                {COMPANY.supportEmail}
              </a>
            </li>
          </ul>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="min-w-0">
            <h2 className="text-sm font-semibold text-zinc-900">{col.title}</h2>
            <ul className="mt-3 space-y-1 text-sm text-zinc-600">
              {col.links.map((link) => (
                <li key={link.href}>
                  {/* py-1.5: dokunma hedefi en az 24 px (PageSpeed/WCAG 2.5.8) */}
                  <Link href={link.href} className="inline-block py-1.5 hover:text-brand-700 hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="site-footer-columns-divider border-t border-zinc-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 text-xs text-zinc-600 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <p>
            © {new Date().getFullYear()} Evden Eve Nakliyat · {SITE_NAME}
          </p>
          <nav aria-label="Yasal metinler">
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
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
