"use client";

import { SideNav } from "@/components/panel/side-nav";
import { BellIcon, InboxIcon, UserIcon } from "@/components/ui/icons";

/** Müşteri hesabı menüsü. unreadMessages: firmalardan gelen okunmamış mesajlar (Taleplerim rozetinde). */
export function AccountNav({ unreadMessages = 0 }: { unreadMessages?: number }) {
  return (
    <SideNav
      label="Hesabım"
      sections={[
        {
          title: "Taşınma",
          items: [
            {
              href: "/hesabim",
              label: "Taleplerim",
              icon: InboxIcon,
              match: (p) => p === "/hesabim" || p.startsWith("/hesabim/talepler"),
              badge: { count: unreadMessages, label: "yeni mesaj" },
            },
          ],
        },
        {
          title: "Hesap",
          items: [
            { href: "/hesabim/hesap", label: "Hesap bilgileri", icon: UserIcon },
            { href: "/hesabim/bildirimler", label: "Bildirimler", icon: BellIcon },
          ],
        },
      ]}
    />
  );
}
