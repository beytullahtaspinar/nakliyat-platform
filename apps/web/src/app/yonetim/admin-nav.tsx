"use client";

import { SideNav } from "@/components/panel/side-nav";
import { BuildingIcon, CalculatorIcon, ChartIcon, ClipboardIcon, GridIcon, ShieldCheckIcon, StarIcon, UsersIcon } from "@/components/ui/icons";

export function AdminNav({ pendingCompanies, pendingDocuments }: { pendingCompanies: number; pendingDocuments: number }) {
  return (
    <SideNav
      label="Yönetim"
      sections={[
        {
          items: [
            { href: "/yonetim", label: "Pano", icon: GridIcon, exact: true },
            { href: "/yonetim/istatistikler", label: "İstatistikler", icon: ChartIcon },
            {
              href: "/yonetim/firmalar",
              label: "Firmalar",
              icon: BuildingIcon,
              badge: { count: pendingCompanies, label: "onay bekleyen firma" },
            },
            {
              href: "/yonetim/belgeler",
              label: "Belgeler",
              icon: ShieldCheckIcon,
              badge: { count: pendingDocuments, label: "onay bekleyen belge" },
            },
            { href: "/yonetim/talepler", label: "Talepler", icon: ClipboardIcon },
            { href: "/yonetim/degerlendirmeler", label: "Değerlendirmeler", icon: StarIcon },
            { href: "/yonetim/kullanicilar", label: "Kullanıcılar", icon: UsersIcon },
            { href: "/yonetim/fiyat-hesaplama", label: "Fiyat hesaplayıcı", icon: CalculatorIcon },
          ],
        },
      ]}
    />
  );
}
