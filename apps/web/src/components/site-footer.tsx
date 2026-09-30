import Link from "next/link";
import { citySlug } from "@nakliyat/locations";
import { LogoMark } from "@/components/ui/logo";
import { HUB_PATH } from "@/lib/local-content";
import { LAUNCH_CITIES } from "@/lib/local-seo";

const COLUMNS = [
  {
    title: "Taşınacaklar için",
    links: [
      { href: "/talep-olustur", label: "Ücretsiz teklif al" },
      { href: "/#nasil-calisir", label: "Nasıl çalışır?" },
      { href: HUB_PATH, label: "81 ilde nakliyat" },
      { href: "/giris", label: "Giriş yap" },
    ],
  },
  {
    title: "Nakliyat firmaları için",
    links: [
      { href: "/kayit?rol=firma", label: "Firma olarak katıl" },
      { href: "/giris?next=/firma-paneli", label: "Firma paneli" },
    ],
  },
  {
    title: "Popüler iller",
    links: LAUNCH_CITIES.map((c) => ({ href: `/${citySlug(c)}`, label: `${c.name} evden eve nakliyat` })),
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-display font-bold text-zinc-900 dark:text-white">evdenevenakliyat.app</span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-zinc-600 dark:text-zinc-400">
            Türkiye genelinde evden eve ve şehirler arası nakliyat için K3 belgeli, doğrulanmış
            firmalardan teklif alıp karşılaştırabileceğin platform.
          </p>
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
      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-zinc-500 sm:px-6">
          © {new Date().getFullYear()} evdenevenakliyat.app
        </p>
      </div>
    </footer>
  );
}
