"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { MAP_STYLE_URL, type LatLng } from "@/lib/geo";

/** Çıkış (yeşil) ve varış (sarı) işaretlerini gösteren salt okunur harita */
export default function RouteMap({ from, to }: { from: LatLng | null; to: LatLng | null }) {
  const container = useRef<HTMLDivElement>(null);
  const key = JSON.stringify([from, to]);

  useEffect(() => {
    const points = [from, to].filter((p): p is LatLng => p !== null);
    if (!container.current || points.length === 0) return;
    const m = new maplibregl.Map({
      container: container.current,
      style: MAP_STYLE_URL,
      center: [points[0]!.lng, points[0]!.lat],
      zoom: 15,
      attributionControl: { compact: true },
      cooperativeGestures: true,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    if (from) new maplibregl.Marker({ color: "#1e3a8a" }).setLngLat([from.lng, from.lat]).addTo(m);
    if (to) new maplibregl.Marker({ color: "#f59e0b" }).setLngLat([to.lng, to.lat]).addTo(m);
    if (points.length === 2) {
      const bounds = new maplibregl.LngLatBounds();
      points.forEach((p) => bounds.extend([p.lng, p.lat]));
      m.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
    }
    return () => m.remove();
    // Nesne kimliği değil koordinatlar önemli
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div
      ref={container}
      role="img"
      aria-label="Çıkış ve varış noktaları haritası"
      className="mt-3 h-64 w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 sm:h-80"
    />
  );
}
