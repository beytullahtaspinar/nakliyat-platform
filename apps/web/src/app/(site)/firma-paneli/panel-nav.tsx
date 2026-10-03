"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const TABS = [
  {
    href: "/firma-paneli",
    label: "Gelen talepler",
    match: (p: string) => p === "/firma-paneli" || p.startsWith("/firma-paneli/talepler"),
  },
  { href: "/firma-paneli/teklifler", label: "Tekliflerim" },
  { href: "/firma-paneli/isler", label: "İşlerim" },
  { href: "/firma-paneli/takvim", label: "Takvim" },
  { href: "/firma-paneli/degerlendirmeler", label: "Değerlendirmeler" },
  { href: "/firma-paneli/profil", label: "Firma profili" },
  { href: "/firma-paneli/tanitim", label: "Tanıtım sayfası" },
  { href: "/firma-paneli/belgeler", label: "Belgeler" },
  { href: "/firma-paneli/bildirimler", label: "Bildirimler" },
];

/** unreadMessages: okunmamış mesaj sayısı, İşlerim sekmesinde gösterilir */
export function PanelNav({ unreadMessages = 0 }: { unreadMessages?: number }) {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  // Telefonda seçili sekme ekranın dışında kalmasın (ör. Bildirimler)
  useEffect(() => {
    const current = nav.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (current && nav.current)
      nav.current.scrollLeft = current.offsetLeft - nav.current.clientWidth / 2 + current.offsetWidth / 2;
  }, [pathname]);
  return (
    // Sağ kenardaki solma: sekmelerin yana kaydığını belli eder (geniş ekranda hepsi sığar)
    <div className="relative mt-6 after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-10 after:bg-gradient-to-l after:from-white after:to-transparent md:after:hidden">
      <nav
        ref={nav}
        aria-label="Firma paneli"
        className="relative overflow-x-auto border-b border-zinc-200 pr-8 md:pr-0 dark:border-zinc-800"
      >
        <ul className="flex gap-1 whitespace-nowrap">
          {TABS.map((tab) => {
            const active = tab.match ? tab.match(pathname) : pathname.startsWith(tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`-mb-px inline-block border-b-2 px-3 py-2.5 text-sm font-medium ${
                    active
                      ? "border-brand-700 text-brand-800 dark:border-brand-400 dark:text-brand-200"
                      : "border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  {tab.label}
                  {tab.href === "/firma-paneli/isler" && unreadMessages > 0 && " "}
                  {tab.href === "/firma-paneli/isler" && unreadMessages > 0 && (
                    <span className="ml-0.5 rounded-full bg-accent-100 px-1.5 py-0.5 text-xs font-semibold text-accent-900">
                      {unreadMessages}
                      <span className="sr-only"> yeni mesaj</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
