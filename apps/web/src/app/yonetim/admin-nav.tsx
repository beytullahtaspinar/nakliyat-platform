"use client";

import { SideNav } from "@/components/panel/side-nav";
import { BuildingIcon, CalculatorIcon, ChartIcon, ClipboardIcon, GridIcon, ShieldCheckIcon, StarIcon, TagIcon, UsersIcon, WalletIcon } from "@/components/ui/icons";

export function AdminNav({
  pendingCompanies,
  pendingDocuments,
  pendingNameChanges,
}: {
  pendingCompanies: number;
  pendingDocuments: number;
  pendingNameChanges: number;
}) {
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
            {
              href: "/yonetim/ad-degisiklikleri",
              label: "Ad değişiklikleri",
              icon: TagIcon,
              badge: { count: pendingNameChanges, label: "onay bekleyen ad değişikliği" },
            },
            { href: "/yonetim/talepler", label: "Talepler", icon: ClipboardIcon },
            { href: "/yonetim/degerlendirmeler", label: "Değerlendirmeler", icon: StarIcon },
            { href: "/yonetim/kullanicilar", label: "Kullanıcılar", icon: UsersIcon },
            { href: "/yonetim/krediler", label: "Krediler", icon: WalletIcon },
            { href: "/yonetim/fiyat-hesaplama", label: "Fiyat hesaplayıcı", icon: CalculatorIcon },
          ],
        },
      ]}
    />
  );
}
