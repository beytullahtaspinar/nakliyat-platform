"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { LatLng } from "@/lib/geo";

// Harita kütüphanesi yalnızca düğmeye basılınca indirilir (PageSpeed)
const MapPicker = dynamic(() => import("./map-picker"), {
  ssr: false,
  loading: () => <div className="mt-2 h-72 animate-pulse rounded-lg bg-zinc-100 sm:h-80" aria-label="Harita yükleniyor" />,
});

type Props = {
  prefix: "from" | "to";
  /** Yazılan açık adres, ilçe ve il; harita açılınca bu adres aranır */
  address: string;
  area: string;
  /** Haritada seçilen yerin adresi açık adres alanına yazılsın diye */
  onAddress: (street: string) => void;
};

/** Talep formunda isteğe bağlı konum işareti; enlem/boylam gizli alanlarla gönderilir. */
export function LocationField({ prefix, address, area, onAddress }: Props) {
  const [open, setOpen] = useState(false);
  const [point, setPoint] = useState<LatLng | null>(null);

  return (
    <div className="sm:col-span-2">
      {point && (
        <>
          <input type="hidden" name={`${prefix}Lat`} value={point.lat.toFixed(6)} />
          <input type="hidden" name={`${prefix}Lng`} value={point.lng.toFixed(6)} />
        </>
      )}
      {open ? (
        <MapPicker
          value={point}
          onChange={setPoint}
          onAddress={onAddress}
          address={address}
          area={area}
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
            <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
          </svg>
          Haritada işaretle (isteğe bağlı)
        </button>
      )}
      <p className="mt-1 text-xs text-zinc-500">
        {open
          ? "Firmalar yalnızca ilçeni görür; işaret ve açık adres, teklifini kabul ettiğin firmaya yol tarifi için gösterilir."
          : "İşaretlersen gerçek yol mesafesi hesaplanır, firman kapını kolay bulur."}
      </p>
    </div>
  );
}
