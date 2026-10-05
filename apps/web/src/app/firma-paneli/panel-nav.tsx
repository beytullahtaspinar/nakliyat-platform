"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  BellIcon,
  BuildingIcon,
  CalendarIcon,
  GlobeIcon,
  InboxIcon,
  ShieldCheckIcon,
  StarIcon,
  TagIcon,
  TruckIcon,
} from "@/components/ui/icons";

type Item = { href: string; label: string; icon: typeof InboxIcon; match?: (p: string) => boolean };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "İşler",
    items: [
      {
        href: "/firma-paneli",
        label: "Gelen talepler",
        icon: InboxIcon,
        match: (p) => p === "/firma-paneli" || p.startsWith("/firma-paneli/talepler"),
      },
      { href: "/firma-paneli/teklifler", label: "Tekliflerim", icon: TagIcon },
      { href: "/firma-paneli/isler", label: "İşlerim", icon: TruckIcon },
      { href: "/firma-paneli/takvim", label: "Takvim", icon: CalendarIcon },
      { href: "/firma-paneli/degerlendirmeler", label: "Değerlendirmeler", icon: StarIcon },
    ],
  },
  {
    title: "Firma",
    items: [
      { href: "/firma-paneli/profil", label: "Firma profili", icon: BuildingIcon },
      { href: "/firma-paneli/tanitim", label: "Tanıtım sayfası", icon: GlobeIcon },
      { href: "/firma-paneli/belgeler", label: "Belgeler", icon: ShieldCheckIcon },
      { href: "/firma-paneli/bildirimler", label: "Bildirimler", icon: BellIcon },
    ],
  },
];

const ITEMS = GROUPS.flatMap((g) => g.items);
const isActive = (item: Item, pathname: string) => (item.match ? item.match(pathname) : pathname.startsWith(item.href));

/** Bulunulan bölümün adı: sayfa başlığı (h1) olarak kullanılır */
export function PanelTitle({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  return <h1 className={className}>{ITEMS.find((item) => isActive(item, pathname))?.label ?? "Firma paneli"}</h1>;
}

/**
 * Geniş ekranda sol menü (gruplu, simgeli), telefon ve tablette üstte yatay kayan menü. Kaydırma çubuğu
 * gizli; sağ kenardaki solma menünün yana kaydığını belli eder. unreadMessages: İşlerim'deki rozet.
 */
export function PanelNav({ unreadMessages = 0 }: { unreadMessages?: number }) {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  // Telefonda seçili sekme ekranın dışında kalmasın (ör. Bildirimler); dikey menüde etkisi yok
  useEffect(() => {
    const current = nav.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (current && nav.current)
      nav.current.scrollLeft = current.offsetLeft - nav.current.clientWidth / 2 + current.offsetWidth / 2;
  }, [pathname]);

  return (
    <div className="relative after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-10 after:bg-gradient-to-l after:from-white after:to-transparent lg:after:hidden">
      <nav
        ref={nav}
        aria-label="Firma paneli"
        className="relative overflow-x-auto px-2 pr-8 pb-2 [scrollbar-width:none] lg:overflow-visible lg:px-3 lg:pb-0 [&::-webkit-scrollbar]:hidden"
      >
        <ul className="flex gap-1 whitespace-nowrap lg:flex-col">
          {GROUPS.map((group, i) => [
            <li
              key={group.title}
              aria-hidden
              className={`hidden px-3 pb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase lg:block ${i > 0 ? "pt-5" : "pt-1"}`}
            >
              {group.title}
            </li>,
            ...group.items.map((item) => {
              const { href, label, icon: Icon } = item;
              const active = isActive(item, pathname);
              const badge = href === "/firma-paneli/isler" && unreadMessages > 0;
              return (
                <li key={href}>
                  {/* relative: rozetin sr-only metni kayan menünün dışına taşıp sayfayı yatay kaydırmasın */}
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
                      active ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {label}
                    {badge && " "}
                    {badge && (
                      <span className="ml-auto rounded-full bg-accent-100 px-2 py-0.5 text-xs font-semibold text-accent-800">
                        {unreadMessages}
                        <span className="sr-only"> yeni mesaj</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            }),
          ])}
        </ul>
      </nav>
    </div>
  );
}
