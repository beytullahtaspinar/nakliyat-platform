"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BuildingIcon, CalculatorIcon, ChartIcon, ClipboardIcon, GridIcon, ShieldCheckIcon, StarIcon, UsersIcon } from "@/components/ui/icons";

const ITEMS = [
  { href: "/yonetim", label: "Pano", icon: GridIcon, exact: true },
  { href: "/yonetim/istatistikler", label: "İstatistikler", icon: ChartIcon },
  { href: "/yonetim/firmalar", label: "Firmalar", icon: BuildingIcon },
  { href: "/yonetim/belgeler", label: "Belgeler", icon: ShieldCheckIcon },
  { href: "/yonetim/talepler", label: "Talepler", icon: ClipboardIcon },
  { href: "/yonetim/degerlendirmeler", label: "Değerlendirmeler", icon: StarIcon },
  { href: "/yonetim/kullanicilar", label: "Kullanıcılar", icon: UsersIcon },
  { href: "/yonetim/fiyat-hesaplama", label: "Fiyat hesaplayıcı", icon: CalculatorIcon },
];

export function AdminNav({ pendingCompanies, pendingDocuments }: { pendingCompanies: number; pendingDocuments: number }) {
  const badges: Record<string, { count: number; label: string }> = {
    "/yonetim/firmalar": { count: pendingCompanies, label: "onay bekleyen firma" },
    "/yonetim/belgeler": { count: pendingDocuments, label: "onay bekleyen belge" },
  };
  const pathname = usePathname();
  return (
    <nav aria-label="Yönetim" className="relative overflow-x-auto px-2 pb-2 lg:px-3 lg:pb-0">
      <ul className="flex gap-1 whitespace-nowrap lg:flex-col">
        {ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              {/* relative: rozetin ekran okuyucu metni (sr-only, absolute) kayan menünün dışına taşıp telefonda sayfayı yatay kaydırmasın */}
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
                {(badges[href]?.count ?? 0) > 0 && (
                  <span
                    className="ml-auto rounded-full bg-accent-100 px-2 py-0.5 text-xs font-semibold text-accent-800"
                    title={badges[href]!.label}
                  >
                    {badges[href]!.count}
                    <span className="sr-only"> {badges[href]!.label}</span>
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
