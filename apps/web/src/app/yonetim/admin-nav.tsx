"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BuildingIcon, ClipboardIcon, GridIcon, UsersIcon } from "@/components/ui/icons";

const ITEMS = [
  { href: "/yonetim", label: "Pano", icon: GridIcon, exact: true },
  { href: "/yonetim/firmalar", label: "Firmalar", icon: BuildingIcon },
  { href: "/yonetim/talepler", label: "Talepler", icon: ClipboardIcon },
  { href: "/yonetim/kullanicilar", label: "Kullanıcılar", icon: UsersIcon },
];

export function AdminNav({ pendingCompanies }: { pendingCompanies: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Yönetim" className="overflow-x-auto px-2 pb-2 lg:px-3 lg:pb-0">
      <ul className="flex gap-1 whitespace-nowrap lg:flex-col">
        {ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
                {href === "/yonetim/firmalar" && pendingCompanies > 0 && (
                  <span
                    className="ml-auto rounded-full bg-accent-100 px-2 py-0.5 text-xs font-semibold text-accent-800"
                    title="Onay bekleyen firma"
                  >
                    {pendingCompanies}
                    <span className="sr-only"> onay bekleyen</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
