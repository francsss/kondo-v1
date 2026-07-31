"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import {
  createConfiguredMapProvider,
  isMapProviderConfigured,
  MAP_MISSING_CONFIGURATION_MESSAGE,
  type MapController,
} from "@/lib/maps";
import { waitForMapContainer } from "@/lib/maps/provider";

export type HousingMapPoint = {
  id: string;
  title: string;
  locationLabel: string;
  href: string;
  coordinate: { lat: number; lng: number };
  price: { amountMinor: number; currency: string };
};

export function HousingMap({
  compact = false,
  points,
}: {
  compact?: boolean;
  points: HousingMapPoint[];
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const controller = useRef<MapController | null>(null);
  const configured = isMapProviderConfigured();
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">(
    configured && points.length ? "loading" : "fallback",
  );
  const center = useMemo(() => {
    if (!points.length) return { lat: 30.2741, lng: 120.1551 };
    return {
      lat:
        points.reduce((total, point) => total + point.coordinate.lat, 0) /
        points.length,
      lng:
        points.reduce((total, point) => total + point.coordinate.lng, 0) /
        points.length,
    };
  }, [points]);

  useEffect(() => {
    if (!configured || !points.length || !ref.current) return;
    const abort = new AbortController();
    const provider = createConfiguredMapProvider();
    void (async () => {
      try {
        await waitForMapContainer(ref.current!, abort.signal);
        const map = await provider.createMap(ref.current!, {
          center,
          zoom: 11,
          onReady: () => setStatus("ready"),
          onError: () => setStatus("fallback"),
        });
        if (abort.signal.aborted) {
          map.destroy();
          return;
        }
        controller.current = map;
        map.setMarkers(
          points.map((point) => ({
            id: point.id,
            coordinate: point.coordinate,
            title: `${point.title}, ${point.locationLabel}`,
            label: `${point.price.currency} ${Math.round(point.price.amountMinor / 100)}`,
            variant: "housing",
            onClick: () => window.location.assign(point.href),
          })),
        );
      } catch {
        if (!abort.signal.aborted) setStatus("fallback");
      }
    })();
    return () => {
      abort.abort();
      controller.current?.destroy();
      controller.current = null;
    };
  }, [center, configured, points]);

  if (status === "fallback") {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_20%_20%,hsl(var(--muted)),transparent_45%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--muted)))] p-6 text-center ${
          compact ? "min-h-72 sm:min-h-80" : "min-h-[420px] sm:min-h-[600px]"
        }`}
      >
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(hsl(var(--border))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="relative max-w-md">
          <MapPin className="mx-auto h-9 w-9 text-kondo-green" />
          <p className="mt-3 font-display text-xl font-black">
            {points.length
              ? "Map unavailable — list view remains ready"
              : "No map-ready homes yet"}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {configured
              ? "Use the nearby listing cards while the map provider reconnects."
              : MAP_MISSING_CONFIGURATION_MESSAGE}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-muted ${
        compact ? "min-h-72 sm:min-h-80" : "min-h-[420px] sm:min-h-[600px]"
      }`}
    >
      <div className="absolute inset-0" ref={ref} />
      {status === "loading" ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-card/70 text-sm font-bold backdrop-blur-sm">
          Loading privacy-safe map…
        </div>
      ) : null}
    </div>
  );
}
