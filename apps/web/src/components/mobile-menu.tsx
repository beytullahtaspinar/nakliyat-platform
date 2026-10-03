"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { AccountMenu } from "@/components/account-menu";
import { NavLink } from "@/components/nav-link";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";

/**
 * Telefonda başlık menüsü: geniş ekrandaki bağlantılar ve hesap işlemleri. Sayfa değişince,
 * Esc'e basınca ya da dışarı dokununca kapanır.
 */
export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Bağlantıya dokununca yeni sayfada menü kapalı açılsın
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={root} className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Menüyü kapat" : "Menü"}
        onClick={() => setOpen((v) => !v)}
        className="-mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100"
      >
        {open ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-zinc-200 bg-white px-4 pt-2 pb-4 shadow-lg sm:px-6"
      >
        <nav aria-label="Menü">
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.href}>
                <NavLink
                  href={l.href}
                  className="flex items-center rounded-lg px-3 py-3 text-base font-medium text-zinc-800 hover:bg-zinc-100 aria-[current=page]:bg-brand-50 aria-[current=page]:text-brand-800"
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-2 border-t border-zinc-200 pt-2 sm:hidden">
          <AccountMenu stacked />
        </div>
      </div>
    </div>
  );
}
