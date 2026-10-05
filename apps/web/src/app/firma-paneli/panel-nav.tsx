"use client";

import { SideNav } from "@/components/panel/side-nav";
import {
  BellIcon,
  BuildingIcon,
  CalendarIcon,
  GridIcon,
  InboxIcon,
  PhotoIcon,
  ShieldCheckIcon,
  StarIcon,
  TagIcon,
  TruckIcon,
  UsersIcon,
} from "@/components/ui/icons";

/**
 * Firma paneli menüsü. newRequests: teklif vermediğin açık talepler, unreadMessages: okunmamış mesajlar.
 */
export function PanelNav({ newRequests = 0, unreadMessages = 0 }: { newRequests?: number; unreadMessages?: number }) {
  return (
    <SideNav
      label="Firma paneli"
      sections={[
        { items: [{ href: "/firma-paneli", label: "Pano", icon: GridIcon, exact: true }] },
        {
          title: "Satış",
          items: [
            {
              href: "/firma-paneli/talepler",
              label: "Gelen talepler",
              icon: InboxIcon,
              badge: { count: newRequests, label: "teklif bekleyen talep" },
            },
            { href: "/firma-paneli/teklifler", label: "Tekliflerim", icon: TagIcon },
            {
              href: "/firma-paneli/isler",
              label: "İşlerim",
              icon: TruckIcon,
              badge: { count: unreadMessages, label: "yeni mesaj" },
            },
            { href: "/firma-paneli/takvim", label: "Takvim", icon: CalendarIcon },
            { href: "/firma-paneli/musteriler", label: "Müşteriler", icon: UsersIcon },
          ],
        },
        {
          title: "Firma",
          items: [
            { href: "/firma-paneli/degerlendirmeler", label: "Değerlendirmeler", icon: StarIcon },
            { href: "/firma-paneli/profil", label: "Firma profili", icon: BuildingIcon },
            { href: "/firma-paneli/tanitim", label: "Tanıtım sayfası", icon: PhotoIcon },
            { href: "/firma-paneli/belgeler", label: "Belgeler", icon: ShieldCheckIcon },
          ],
        },
        {
          title: "Ayarlar",
          items: [{ href: "/firma-paneli/bildirimler", label: "Bildirimler", icon: BellIcon }],
        },
      ]}
    />
  );
}
