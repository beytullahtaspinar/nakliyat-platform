"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDownIcon } from "@/components/ui/icons";

export type RowAction = { label: string; href: string; external?: boolean };

/**
 * Tablo satırının "İşlemler" açılır listesi (açılır-kapanır düğme + bağlantılar).
 * Dışarı tıklayınca ya da Esc ile kapanır; Esc odağı düğmeye geri verir.
 * Liste sabit konumlu (fixed): yana kayan tablo kabının taşma kırpmasına takılmaz.
 */
export function ActionsMenu({ label, actions }: { label: string; actions: RowAction[] }) {
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const open = position !== null;
  const close = () => setPosition(null);
  const place = () => {
    const rect = button.current!.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  };
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    // Sayfa ya da tablo kabı kayınca liste düğmenin altında kalsın (capture: kabın kendi kaydırması da)
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  return (
    <div ref={root} className="relative inline-block text-left">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => {
          if (open) close();
          else place();
        }}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        İşlemler
        <ChevronDownIcon className="h-4 w-4" />
      </button>
      {position && (
        <ul
          id={id}
          style={position}
          className="fixed z-30 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left text-sm shadow-lg"
        >
          {actions.map((a) => (
            <li key={a.label}>
              {a.external || !a.href.startsWith("/") ? (
                <a
                  href={a.href}
                  {...(a.external && { target: "_blank", rel: "noopener noreferrer" })}
                  className="block px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                >
                  {a.label}
                </a>
              ) : (
                <Link href={a.href} className="block px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900" onClick={close}>
                  {a.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
