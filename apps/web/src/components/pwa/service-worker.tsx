"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/pwa";

/**
 * Servis işçisini sayfa yüklendikten ve tarayıcı boşa çıktıktan sonra kaydeder:
 * ilk açılış hızını (PageSpeed) etkilemez. Hiçbir şey çizmez.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => void registerServiceWorker().catch(() => undefined);
    const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(register, { timeout: 5000 }) : setTimeout(register, 2000));
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
  }, []);
  return null;
}
