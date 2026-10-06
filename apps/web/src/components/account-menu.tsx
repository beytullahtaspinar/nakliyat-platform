"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { LogoutForm } from "@/components/logout-form";
import { ButtonLink } from "@/components/ui/button";
import { SpinnerIcon } from "@/components/ui/icons";

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
 * Bekleme göstergesi. Panel sayfaları her açılışta API'den okunduğu için (ön yükleme yok) dokunmayla
 * sayfanın gelmesi arasında birkaç saniye geçebilir; gösterge olmadan menü "seçilmiyor" sanılıyordu.
 * Telefon menüsünde satırın sağında döner (yer hep ayrılı, yazı kaymaz); başlıkta yazı soluklaşır.
 */
function Pending({ pending, stacked }: { pending: boolean; stacked: boolean }) {
  if (!stacked) return pending ? <span className="sr-only"> (yükleniyor)</span> : null;
  return (
    <>
      <SpinnerIcon
        className={`ml-auto h-5 w-5 shrink-0 text-brand-700 motion-safe:animate-spin ${pending ? "opacity-100" : "opacity-0"}`}
      />
      {pending && <span className="sr-only"> (yükleniyor)</span>}
    </>
  );
}

function HomeLink({ href, label, className, stacked }: { href: string; label: string; className: string; stacked: boolean }) {
  return (
    <Link href={href} className={className}>
      <LinkLabel label={label} stacked={stacked} />
    </Link>
  );
}

/** useLinkStatus yalnızca Link'in içindeki bileşende çalışır */
function LinkLabel({ label, stacked }: { label: string; stacked: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span className={pending && !stacked ? "opacity-50" : undefined}>{label}</span>
      <Pending pending={pending} stacked={stacked} />
    </>
  );
}

function LogoutButton({ className, stacked }: { className: string; stacked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className} disabled:cursor-wait ${pending && !stacked ? "opacity-50" : ""}`}
    >
      Çıkış
      <Pending pending={pending} stacked={stacked} />
    </button>
  );
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
      <HomeLink href={home.href} label={home.label} className={item} stacked={stacked} />
      <LogoutForm className={stacked ? undefined : "flex"}>
        <LogoutButton
          stacked={stacked}
          className={
            stacked
              ? `${item} text-zinc-600`
              : "text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }
        />
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
