"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { LogoutForm } from "@/components/logout-form";
import { ButtonLink } from "@/components/ui/button";

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
 * Sayfalar statik kalsın diye oturum sunucuda değil, tarayıcıdaki arayüz çerezinden okunur
 * (yetki kararı API'de verilir).
 */
export function useRole() {
  usePathname(); // sayfa değişince çerezi yeniden oku
  return useSyncExternalStore(subscribe, readRole, () => null);
}

/**
 * Başlıktaki giriş/hesap bağlantısı. `stacked`: telefon menüsündeki alt alta, geniş dokunma alanlı hali.
 */
export function AccountMenu({ stacked = false }: { stacked?: boolean }) {
  const role = useRole();
  const item = stacked
    ? "flex w-full items-center rounded-lg px-3 py-3 text-base font-medium text-zinc-800 hover:bg-zinc-100"
    : "text-sm font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300";

  if (!role) {
    return (
      <Link href="/giris" className={item}>
        Giriş yap
      </Link>
    );
  }
  const home = HOME[role] ?? HOME.CUSTOMER;
  return (
    <div className={stacked ? "space-y-1" : "flex items-center gap-4"}>
      <Link href={home.href} className={item}>
        {home.label}
      </Link>
      <LogoutForm>
        <button
          type="submit"
          className={stacked ? `${item} text-zinc-600` : "text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}
        >
          Çıkış
        </button>
      </LogoutForm>
    </div>
  );
}

/**
 * "Teklif al" çağrısı yalnızca taşınacaklar için. Firma ve yönetici telefonda burada kendi paneline
 * kısa yol görür (geniş ekranda paneli hesap bağlantısı zaten gösteriyor).
 */
export function RequestCta() {
  const role = useRole();
  if (role === "COMPANY" || role === "ADMIN") {
    return (
      <ButtonLink href={HOME[role].href} size="sm" variant="secondary" className="sm:hidden">
        {HOME[role].label}
      </ButtonLink>
    );
  }
  return (
    <ButtonLink href="/talep-olustur" size="sm">
      Teklif al
    </ButtonLink>
  );
}
