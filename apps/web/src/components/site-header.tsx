import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { HUB_PATH } from "@/lib/local-content";

const NAV = [
  { href: "/#nasil-calisir", label: "Nasıl çalışır?" },
  { href: HUB_PATH, label: "İller" },
  { href: "/kayit?rol=firma", label: "Firmalar için" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="evdenevenakliyat.app ana sayfa">
          <Logo />
        </Link>
        <nav aria-label="Ana menü" className="hidden items-center gap-6 text-sm font-medium text-zinc-600 md:flex dark:text-zinc-300">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-brand-700 dark:hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2.5 whitespace-nowrap sm:gap-4">
          <AccountMenu />
          <ButtonLink href="/talep-olustur" size="sm">
            Teklif al
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
