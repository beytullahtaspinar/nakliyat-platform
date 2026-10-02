"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { detectDevice, PUSH_CHANGE_EVENT } from "@/lib/pwa";

const DISMISS_KEY = "nk_uygulama_ipucu";

/**
 * Firma panelinde kısa hatırlatma: bu cihazda anlık bildirim açık değilse yeni talepleri kaçırmamak için
 * telefona kurup bildirimleri açmayı önerir. Kapatılınca bu tarayıcıda bir daha gösterilmez.
 */
export function AppPrompt({ settingsPath }: { settingsPath: string }) {
  const [show, setShow] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      return;
    }
    // iPhone Safari'de push yok ama ana ekrana ekleyince var: kurulumu önermeye değer
    const check = () => void detectDevice().then(({ push }) => setShow(push === "off" || push === "ios-install"));
    check();
    window.addEventListener(PUSH_CHANGE_EVENT, check);
    return () => window.removeEventListener(PUSH_CHANGE_EVENT, check);
  }, []);

  // Ayarlar sayfasında aynı bilgi zaten tam haliyle var
  if (!show || pathname === settingsPath) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setShow(false);
  };

  return (
    <div role="status" className="mt-4 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
      <p className="flex-1">
        <strong>Yeni talepleri anında gör.</strong> Siteyi telefonuna uygulama olarak kur ve bildirimleri aç; müşteri talep
        oluşturduğunda ya da teklifini kabul ettiğinde telefonun çalsın.{" "}
        <Link href={settingsPath} className="font-semibold underline">
          Nasıl yapılır?
        </Link>
      </p>
      <button type="button" onClick={dismiss} aria-label="Hatırlatmayı kapat" className="-m-1 rounded p-1 text-brand-800 hover:bg-brand-100">
        <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
