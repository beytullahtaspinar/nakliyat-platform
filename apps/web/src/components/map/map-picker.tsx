"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { inputClass } from "@/components/forms/fields";
import { MAP_STYLE_URL, TURKEY_CENTER, describePoint, searchPlaces, type LatLng, type Place } from "@/lib/geo";

type Props = {
  value: LatLng | null;
  onChange: (point: LatLng | null) => void;
  /** Formda yazılan açık adres; açılışta aranır */
  address: string;
  /** İlçe ve il; adres bulunamazsa harita buraya odaklanır */
  area: string;
};

/**
 * Adres arama + sürüklenebilir iğne. Yalnızca kullanıcı "Haritada işaretle" deyince yüklenir
 * (maplibre-gl büyük bir kütüphane; ilk açılış hızını etkilememeli).
 */
export default function MapPicker({ value, onChange, address, area }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map>(null);
  const marker = useRef<maplibregl.Marker>(null);
  const lookup = useRef<AbortController>(null);

  const [query, setQuery] = useState([address, area].filter(Boolean).join(", "));
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  /** İğneyi koy; adı bilinmiyorsa okunur adresini sor ki müşteri doğru yeri seçtiğini görsün */
  const pick = (point: LatLng, label?: string) => {
    marker.current?.setLngLat([point.lng, point.lat]).addTo(map.current!);
    onChange(point);
    lookup.current?.abort();
    if (label) return setPicked(label);
    setPicked(null);
    const ctrl = new AbortController();
    lookup.current = ctrl;
    describePoint(point, ctrl.signal)
      .then((name) => !ctrl.signal.aborted && setPicked(name))
      .catch(() => undefined);
  };
  const pickRef = useRef(pick);
  useEffect(() => {
    pickRef.current = pick;
  });

  const choose = (p: Place) => {
    pick(p, p.label);
    map.current?.flyTo({ center: [p.lng, p.lat], zoom: 17 });
    setResults([]);
  };

  const search = async (q: string) => {
    if (q.trim().length < 3) return;
    setSearching(true);
    setMessage(null);
    try {
      const found = await searchPlaces(q, value ?? undefined);
      setResults(found);
      if (found.length === 0) setMessage("Sonuç yok. Mahalle ve sokak adıyla dene ya da haritaya dokun.");
    } catch {
      setMessage("Adres araması şu an çalışmıyor. Haritaya dokunarak işaret koyabilirsin.");
    } finally {
      setSearching(false);
    }
  };

  /** Açılışta: yazılan adresi bulursa iğneyi oraya koy, bulamazsa ilçeye odaklan */
  const locateInitial = async () => {
    try {
      const [found] = address.trim().length >= 5 ? await searchPlaces(`${address}, ${area}`) : [];
      if (found) {
        pickRef.current(found, found.label);
        map.current?.jumpTo({ center: [found.lng, found.lat], zoom: 17 });
        setMessage("Yazdığın adrese göre işaretlendi. Tam yer değilse iğneyi sürükle veya haritaya dokun.");
        return;
      }
      const [focus] = area ? await searchPlaces(area) : [];
      if (focus) map.current?.jumpTo({ center: [focus.lng, focus.lat], zoom: 13 });
      setMessage("Evinin yerine haritada dokunarak işaret koy ya da yukarıdan ara.");
    } catch {
      setMessage("Adres araması şu an çalışmıyor. Haritaya dokunarak işaret koyabilirsin.");
    }
  };

  // Haritayı ve iğneyi bir kez kur
  useEffect(() => {
    if (!container.current) return;
    const m = new maplibregl.Map({
      container: container.current,
      style: MAP_STYLE_URL,
      center: value ? [value.lng, value.lat] : TURKEY_CENTER,
      zoom: value ? 16 : 5,
      attributionControl: { compact: true },
      cooperativeGestures: true,
      locale: {
        "CooperativeGesturesHandler.WindowsHelpText": "Yakınlaştırmak için Ctrl tuşuna basılı tutup kaydırın",
        "CooperativeGesturesHandler.MacHelpText": "Yakınlaştırmak için ⌘ tuşuna basılı tutup kaydırın",
        "CooperativeGesturesHandler.MobileHelpText": "Haritayı iki parmakla kaydırın",
        "NavigationControl.ZoomIn": "Yakınlaştır",
        "NavigationControl.ZoomOut": "Uzaklaştır",
      },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const pin = new maplibregl.Marker({ color: "#136544", draggable: true });
    map.current = m;
    marker.current = pin;
    // Harita kurulduktan sonra (ayrı görevde) yazılan adresi ara
    const initial = value ? undefined : setTimeout(() => void locateInitial(), 0);
    if (value) pin.setLngLat([value.lng, value.lat]).addTo(m);
    pin.on("dragend", () => pickRef.current(pin.getLngLat()));
    m.on("click", (e) => pickRef.current(e.lngLat));
    return () => {
      clearTimeout(initial);
      lookup.current?.abort();
      m.remove();
    };
    // Yalnızca açılışta; sonraki değişiklikleri iğne kendisi taşır
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-2">
        <input
          type="search"
          aria-label="Haritada adres ara"
          placeholder="Mahalle, sokak veya bina adı"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Formu göndermesin, arama yapsın
            if (e.key === "Enter") {
              e.preventDefault();
              void search(query);
            }
          }}
          className={`${inputClass} mt-0`}
        />
        <button
          type="button"
          onClick={() => void search(query)}
          disabled={searching}
          className="shrink-0 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
        >
          {searching ? "Aranıyor…" : "Ara"}
        </button>
      </div>
      {results.length > 0 && (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white text-sm">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button type="button" onClick={() => choose(r)} className="block w-full px-3 py-2 text-left hover:bg-brand-50">
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && (
        <p role="status" className="text-xs text-zinc-600">
          {message}
        </p>
      )}
      <div ref={container} className="h-72 w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 sm:h-80" />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600">
        <span>{value ? (picked ? `İşaretlenen yer: ${picked}` : "Yer işaretlendi.") : "Henüz işaret yok."}</span>
        {value && (
          <button
            type="button"
            onClick={() => {
              lookup.current?.abort();
              marker.current?.remove();
              setPicked(null);
              onChange(null);
            }}
            className="font-medium text-zinc-700 underline"
          >
            İşareti kaldır
          </button>
        )}
      </div>
    </div>
  );
}
