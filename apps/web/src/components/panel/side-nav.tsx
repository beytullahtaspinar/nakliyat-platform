"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ComponentType } from "react";

export type SideNavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Yalnızca tam yol eşleşirse seçili (ör. pano) */
  exact?: boolean;
  /** Seçili sayılan başka yollar */
  match?: (pathname: string) => boolean;
  /** Sağdaki sayaç; ekran okuyucu için açıklamasıyla */
  badge?: { count: number; label: string };
};

export type SideNavSection = { title?: string; items: SideNavItem[] };

/**
 * Panel menüsü: geniş ekranda bölüm başlıklı sol menü, telefonda üstte yatay kayan şerit.
 * Telefonda seçili bağlantı ekranın ortasına kaydırılır, sağ kenardaki solma kaydırılabildiğini belli eder.
 */
export function SideNav({ label, sections }: { label: string; sections: SideNavSection[] }) {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = nav.current;
    const current = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !current) return;
    if (el.scrollWidth > el.clientWidth) el.scrollLeft = current.offsetLeft - el.clientWidth / 2 + current.offsetWidth / 2;
    // Geniş ekranda alçak pencerede menü kendi içinde kayar; seçili bağlantı görünür kalsın
    else if (window.matchMedia("(min-width: 1024px)").matches) current.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  return (
    <div className="relative after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-8 after:bg-gradient-to-l after:from-white after:to-transparent lg:after:hidden">
      <nav ref={nav} aria-label={label} className="relative overflow-x-auto px-2 pb-2 lg:overflow-visible lg:px-3 lg:pb-0">
        <ul className="flex gap-1 pr-6 whitespace-nowrap lg:flex-col lg:pr-0">
          {sections.map((section, i) => (
            <li key={section.title ?? i} className="contents lg:block">
              {section.title && (
                <p className="mt-3 mb-1 hidden px-3 text-xs font-semibold tracking-wide text-slate-500 uppercase lg:block">
                  {section.title}
                </p>
              )}
              <ul className="contents lg:flex lg:flex-col lg:gap-1">
                {section.items.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function NavLink({ item: { href, label, icon: Icon, exact, match, badge }, pathname }: { item: SideNavItem; pathname: string }) {
  const active = match ? match(pathname) : exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const count = badge?.count ?? 0;
  return (
    <li>
      {/* relative: rozetin ekran okuyucu metni (sr-only, absolute) kayan menünün dışına taşıp sayfayı yatay kaydırmasın */}
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium lg:py-1.5 ${
          active ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {label}
        {count > 0 && (
          <span className="ml-auto rounded-full bg-accent-100 px-2 py-0.5 text-xs font-semibold text-accent-800" title={badge!.label}>
            {count}
            <span className="sr-only"> {badge!.label}</span>
          </span>
        )}
      </Link>
    </li>
  );
}
