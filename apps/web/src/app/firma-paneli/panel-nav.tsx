"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/firma-paneli", label: "Gelen talepler", match: (p: string) => p === "/firma-paneli" || p.startsWith("/firma-paneli/talepler") },
  { href: "/firma-paneli/teklifler", label: "Tekliflerim" },
  { href: "/firma-paneli/isler", label: "İşlerim" },
  { href: "/firma-paneli/profil", label: "Firma profili" },
  { href: "/firma-paneli/bildirimler", label: "Bildirimler" },
];

export function PanelNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Firma paneli" className="mt-6 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
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
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
