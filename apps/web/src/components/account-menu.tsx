"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { LogoutForm } from "@/components/logout-form";

type CookieStoreLike = EventTarget;

function subscribe(onChange: () => void) {
  const store = (globalThis as { cookieStore?: CookieStoreLike }).cookieStore;
  store?.addEventListener("change", onChange);
  return () => store?.removeEventListener("change", onChange);
}

const HOME: Record<string, { href: string; label: string }> = {
  CUSTOMER: { href: "/hesabim", label: "Hesabım" },
  COMPANY: { href: "/firma-paneli", label: "Firma paneli" },
  ADMIN: { href: "/yonetim", label: "Yönetim" },
};

const readRole = () => document.cookie.match(/(?:^|;\s*)nk_rol=([^;]+)/)?.[1] ?? null;

/**
 * Başlıktaki giriş/hesap bağlantısı. Sayfalar statik kalsın diye oturum sunucuda değil,
 * tarayıcıdaki arayüz çerezinden okunur (yetki kararı API'de verilir).
 */
export function AccountMenu() {
  usePathname(); // sayfa değişince çerezi yeniden oku
  const role = useSyncExternalStore(subscribe, readRole, () => null);

  if (!role) {
    return (
      <Link href="/giris" className="text-sm font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300">
        Giriş yap
      </Link>
    );
  }
  const home = HOME[role] ?? HOME.CUSTOMER;
  return (
    <div className="flex items-center gap-4 text-sm font-medium">
      <Link href={home.href} className="text-zinc-700 hover:text-zinc-950 dark:text-zinc-300">
        {home.label}
      </Link>
      <LogoutForm>
        <button type="submit" className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          Çıkış
        </button>
      </LogoutForm>
    </div>
  );
}
