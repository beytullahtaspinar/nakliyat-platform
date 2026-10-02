"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { googleDirectionsUrl, yandexDirectionsUrl, type Stop } from "@/lib/geo";

const RouteMap = dynamic(() => import("./route-map"), {
  ssr: false,
  loading: () => <div className="mt-3 h-64 animate-pulse rounded-lg bg-zinc-100 sm:h-80" aria-label="Harita yükleniyor" />,
});

const linkClass =
  "inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50";

/**
 * Yol tarifi bağlantıları ve isteğe bağlı harita. Yalnızca açık adresi görme hakkı olanlara gösterilir
 * (müşterinin kendisi, teklifi kabul edilen firma).
 */
export function RouteOverview({ from, to, directions = true }: { from: Stop; to: Stop; directions?: boolean }) {
  const [showMap, setShowMap] = useState(false);
  const hasPin = Boolean(from.location || to.location);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {directions && (
          <>
            <a href={googleDirectionsUrl(from, to)} target="_blank" rel="noopener noreferrer" className={linkClass}>
              Yol tarifi al (Google Haritalar)
            </a>
            {from.location && to.location && (
              <a
                href={yandexDirectionsUrl(from.location, to.location)}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                Yandex Haritalar
              </a>
            )}
          </>
        )}
        {hasPin && !showMap && (
          <button type="button" onClick={() => setShowMap(true)} className={linkClass}>
            Haritada göster
          </button>
        )}
      </div>
      {showMap && <RouteMap from={from.location} to={to.location} />}
    </div>
  );
}
