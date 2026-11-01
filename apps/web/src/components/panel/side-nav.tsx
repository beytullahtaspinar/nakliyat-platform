"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore, type ComponentType } from "react";
import { ChevronDownIcon } from "@/components/ui/icons";

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

const isActive = ({ href, exact, match }: SideNavItem, pathname: string) =>
  match ? match(pathname) : exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

/**
 * Panel menüsü: geniş ekranda bölüm başlıklı sol menü, telefonda üstte yatay kayan şerit.
 * Telefonda seçili bağlantı ekranın ortasına kaydırılır, sağ kenardaki solma kaydırılabildiğini belli eder.
 *
 * collapsible: geniş ekranda başlıklı bölümler açılıp kapanır (başta hepsi açık); kapalı bölümün başlığında
 * bekleyen işlerin toplamı görünür, seçili sayfanın bölümü hep açıktır. Kapatılanlar bu tarayıcıda hatırlanır.
 * Telefonda şeritte bölüm adları ayraç olarak görünür.
 */
export function SideNav({
  label,
  sections,
  collapsible,
}: {
  label: string;
  sections: SideNavSection[];
  /** Kapatılan bölümlerin saklandığı localStorage anahtarı */
  collapsible?: { storageKey: string };
}) {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  const storageKey = collapsible?.storageKey;
  const closed = useClosedSections(storageKey);

  useEffect(() => {
    const el = nav.current;
    const current = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !current) return;
    if (el.scrollWidth > el.clientWidth) el.scrollLeft = current.offsetLeft - el.clientWidth / 2 + current.offsetWidth / 2;
    // Geniş ekranda alçak pencerede menü kendi içinde kayar; seçili bağlantı görünür kalsın
    else if (window.matchMedia("(min-width: 1024px)").matches) current.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  const toggle = (title: string) => {
    if (storageKey) saveClosed(storageKey, closed.includes(title) ? closed.filter((t) => t !== title) : [...closed, title]);
  };

  return (
    <div className="relative after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-8 after:bg-gradient-to-l after:from-white after:to-transparent lg:after:hidden">
      <nav ref={nav} aria-label={label} className="relative overflow-x-auto px-2 pb-2 lg:overflow-visible lg:px-3 lg:pb-0">
        <ul className="flex gap-1 pr-6 whitespace-nowrap lg:flex-col lg:pr-0">
          {sections.map((section, i) => {
            const id = `menu-${i}`;
            const hasActive = section.items.some((item) => isActive(item, pathname));
            const canCollapse = Boolean(collapsible && section.title);
            const open = !canCollapse || hasActive || !closed.includes(section.title!);
            const pending = section.items.reduce((sum, item) => sum + (item.badge?.count ?? 0), 0);
            return (
              <li key={section.title ?? i} className="contents lg:block">
                {section.title &&
                  (canCollapse ? (
                    <>
                      {/* Telefonda şeritte bölüm ayracı; geniş ekranda açılır-kapanır başlık */}
                      <span
                        aria-hidden="true"
                        className={`flex items-center px-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase lg:hidden ${
                          i > 0 ? "ml-1 border-l border-slate-200 pl-3" : ""
                        }`}
                      >
                        {section.title}
                      </span>
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={id}
                        disabled={hasActive}
                        onClick={() => toggle(section.title!)}
                        className="relative mt-3 mb-1 hidden w-full items-center gap-1 rounded px-3 py-0.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase hover:text-slate-800 disabled:cursor-default disabled:hover:text-slate-500 lg:flex"
                      >
                        {section.title}
                        {!open && pending > 0 && (
                          <span className="ml-1 rounded-full bg-accent-100 px-1.5 text-[11px] font-semibold text-accent-800 normal-case">
                            {pending}
                            <span className="sr-only"> bekleyen iş</span>
                          </span>
                        )}
                        <ChevronDownIcon
                          className={`ml-auto h-4 w-4 transition-transform ${open ? "" : "-rotate-90"} ${hasActive ? "opacity-0" : ""}`}
                        />
                      </button>
                    </>
                  ) : (
                    <p className="mt-3 mb-1 hidden px-3 text-xs font-semibold tracking-wide text-slate-500 uppercase lg:block">
                      {section.title}
                    </p>
                  ))}
                <ul id={id} className={`contents lg:flex-col lg:gap-1 ${open ? "lg:flex" : "lg:hidden"}`}>
                  {section.items.map((item) => (
                    <NavLink key={item.href} item={item} active={isActive(item, pathname)} />
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** Kapatılan bölümler bu tarayıcıda saklanır; sunucuda ve kayıt yokken hepsi açık */
const CHANGE_EVENT = "panel-menu-change";

function useClosedSections(storageKey: string | undefined): string[] {
  const raw = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener(CHANGE_EVENT, onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(CHANGE_EVENT, onChange);
      };
    },
    () => {
      try {
        return storageKey ? localStorage.getItem(storageKey) : null;
      } catch {
        return null; // Gizli pencere vb.: bölümler açık kalır
      }
    },
    () => null,
  );
  return parseClosed(raw);
}

const parsed = new Map<string, string[]>();
function parseClosed(raw: string | null): string[] {
  if (!raw) return [];
  // Aynı kayıt için aynı dizi: her çizimde yeni dizi üretilmesin
  let value = parsed.get(raw);
  if (!value) {
    try {
      const data: unknown = JSON.parse(raw);
      value = Array.isArray(data) ? data.filter((s): s is string => typeof s === "string") : [];
    } catch {
      value = [];
    }
    parsed.set(raw, value);
  }
  return value;
}

function saveClosed(storageKey: string, closed: string[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(closed));
  } catch {
    return; // Kaydedilemiyor: menü olduğu gibi kalır
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function NavLink({ item: { href, label, icon: Icon, badge }, active }: { item: SideNavItem; active: boolean }) {
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
