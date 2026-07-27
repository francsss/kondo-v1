"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  Compass,
  Crown,
  Languages,
  LoaderCircle,
  MapPin,
  MessageCircle,
  School,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { OfficialMark } from "@/components/features/official-profile/OfficialMark";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { MEET_PREMIUM_FEATURES } from "@/features/meet/config";
import {
  meetMapRadiusKm,
  meetMapZoom,
  privacySafeMapCoordinate,
  type MeetMapDistance,
} from "@/lib/meet-map";
import { defaultAvatarDataUri } from "@/lib/presentation";

export type MeetDiscoveryProfile = {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string;
  avatarMediaId: string | null;
  bio: string | null;
  gender: "MALE" | "FEMALE" | null;
  age: number | null;
  lastActiveAt: string | null;
  distanceLabel: string | null;
  location: {
    city: string | null;
    countryName: string | null;
    countryEmoji: string | null;
  } | null;
  university: string | null;
  languages: string[];
  sharedInterests: string[];
  lookingFor: string[];
  official: {
    organizationType: string | null;
    organizationName: string | null;
    verifiedAt: string | null;
  } | null;
};

type BaiduPoint = { lng: number; lat: number };
type BaiduOverlay = {
  addEventListener?(event: string, listener: () => void): void;
};
type BaiduMapInstance = {
  centerAndZoom(point: BaiduPoint, zoom: number): void;
  enableScrollWheelZoom(enabled: boolean): void;
  addControl(control: unknown): void;
  addOverlay(overlay: BaiduOverlay): void;
  clearOverlays(): void;
};
type BaiduMapsApi = {
  Map: new (
    container: HTMLElement,
    options?: { enableMapClick?: boolean },
  ) => BaiduMapInstance;
  Point: new (lng: number, lat: number) => BaiduPoint;
  Geocoder: new () => {
    getPoint(
      query: string,
      callback: (point: BaiduPoint | null) => void,
      city?: string,
    ): void;
  };
  NavigationControl: new () => unknown;
  ScaleControl: new () => unknown;
  Size: new (width: number, height: number) => unknown;
  Icon: new (
    imageUrl: string,
    size: unknown,
    options?: { imageSize?: unknown; anchor?: unknown },
  ) => unknown;
  Marker: new (
    point: BaiduPoint,
    options?: { icon?: unknown; title?: string },
  ) => BaiduOverlay;
  Circle: new (
    point: BaiduPoint,
    radiusMeters: number,
    options?: Record<string, unknown>,
  ) => BaiduOverlay;
};

declare global {
  interface Window {
    BMapGL?: BaiduMapsApi;
    __kondoBaiduMapReady?: () => void;
  }
}

let baiduLoader: Promise<BaiduMapsApi> | null = null;

function loadBaiduMaps(apiKey: string) {
  if (window.BMapGL) return Promise.resolve(window.BMapGL);
  if (baiduLoader) return baiduLoader;
  baiduLoader = new Promise<BaiduMapsApi>((resolve, reject) => {
    const existing = document.getElementById("kondo-baidu-map-script");
    const timeout = window.setTimeout(() => {
      document.getElementById("kondo-baidu-map-script")?.remove();
      baiduLoader = null;
      reject(new Error("Baidu Maps took too long to load."));
    }, 15_000);
    window.__kondoBaiduMapReady = () => {
      window.clearTimeout(timeout);
      if (window.BMapGL) resolve(window.BMapGL);
      else reject(new Error("Baidu Maps did not initialize."));
    };
    existing?.remove();
    const script = document.createElement("script");
    script.id = "kondo-baidu-map-script";
    script.async = true;
    script.defer = true;
    script.src = `https://api.map.baidu.com/api?v=1.0&type=webgl&ak=${encodeURIComponent(apiKey)}&callback=__kondoBaiduMapReady`;
    script.onerror = () => {
      window.clearTimeout(timeout);
      script.remove();
      baiduLoader = null;
      reject(new Error("Baidu Maps could not be loaded."));
    };
    document.head.appendChild(script);
  });
  return baiduLoader;
}

function intentLabel(intent: string) {
  return intent
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (value) => value.toUpperCase());
}

function maskedFirstName(firstName: string) {
  const first = firstName.trim();
  return `${first.slice(0, 1)}${"*".repeat(
    Math.min(4, Math.max(2, first.length - 1)),
  )}`;
}

function geocodeArea(
  api: BaiduMapsApi,
  query: string,
  cityName: string | null,
) {
  const candidates = [...new Set([query, cityName, "China"].filter(Boolean))];
  return new Promise<BaiduPoint>((resolve, reject) => {
    const geocoder = new api.Geocoder();
    const attempt = (index: number) => {
      const candidate = candidates[index];
      if (!candidate) {
        reject(new Error("The selected study area was not found."));
        return;
      }
      geocoder.getPoint(
        candidate,
        (point) => {
          if (point) resolve(point);
          else attempt(index + 1);
        },
        cityName ?? "China",
      );
    };
    attempt(0);
  });
}

export function MeetDiscoveryMap({
  profiles,
  mode,
  areaLabel,
  mapQuery,
  cityName,
  distanceRange,
  premiumFeatures,
  onPremiumRequest,
}: {
  profiles: MeetDiscoveryProfile[];
  mode: "NEARBY" | "LOOKING_FOR";
  areaLabel: string;
  mapQuery: string;
  cityName: string | null;
  distanceRange: MeetMapDistance;
  premiumFeatures: string[];
  onPremiumRequest: (reason: string) => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_BAIDU_MAP_AK?.trim();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<MeetDiscoveryProfile | null>(null);
  const [mapStatus, setMapStatus] = useState<
    "loading" | "ready" | "unconfigured" | "error"
  >(!apiKey ? "unconfigured" : mapQuery ? "loading" : "error");
  const [mapError, setMapError] = useState(
    !apiKey
      ? "The real map is not configured yet. Add NEXT_PUBLIC_BAIDU_MAP_AK in Vercel Production."
      : mapQuery
        ? ""
        : "Choose a study university and city before opening the nearby map.",
  );
  const canViewFullProfile = premiumFeatures.includes(
    MEET_PREMIUM_FEATURES.FULL_PROFILES,
  );
  const canConnect = premiumFeatures.includes(
    MEET_PREMIUM_FEATURES.MAP_CONNECTIONS,
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!apiKey || !container || !mapQuery) return;
    let cancelled = false;
    void loadBaiduMaps(apiKey)
      .then(async (api) => {
        if (cancelled) return;
        container.replaceChildren();
        const map = new api.Map(container, { enableMapClick: false });
        const anchor = await geocodeArea(api, mapQuery, cityName);
        if (cancelled) return;
        map.centerAndZoom(anchor, meetMapZoom(distanceRange));
        map.enableScrollWheelZoom(true);
        map.addControl(new api.NavigationControl());
        map.addControl(new api.ScaleControl());
        map.addOverlay(
          new api.Circle(anchor, meetMapRadiusKm(distanceRange) * 1_000, {
            strokeColor: "#16a36a",
            strokeWeight: 1,
            strokeOpacity: 0.48,
            fillColor: "#34d399",
            fillOpacity: 0.08,
          }),
        );
        for (const profile of profiles) {
          const coordinate = privacySafeMapCoordinate(
            anchor,
            profile.id,
            distanceRange,
          );
          const point = new api.Point(coordinate.lng, coordinate.lat);
          const size = new api.Size(48, 48);
          const icon = new api.Icon(
            profile.avatarMediaId
              ? `/api/media/${profile.avatarMediaId}`
              : defaultAvatarDataUri(
                  profile.firstName,
                  profile.lastName,
                  profile.id,
                ),
            size,
            {
              imageSize: size,
              anchor: new api.Size(24, 24),
            },
          );
          const marker = new api.Marker(point, {
            icon,
            title: `Approximate area for ${maskedFirstName(profile.firstName)}`,
          });
          marker.addEventListener?.("click", () => setSelected(profile));
          map.addOverlay(marker);
        }
        setMapStatus("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        setMapStatus("error");
        setMapError(
          error instanceof Error
            ? `${error.message} Check the Baidu Maps key and its domain allowlist.`
            : "The real map could not be loaded.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey, cityName, distanceRange, mapQuery, profiles]);

  return (
    <section
      aria-label="Nearby discovery map"
      className="relative min-h-[480px] overflow-hidden rounded-[2rem] border border-border bg-muted shadow-lift"
      data-map-provider="baidu"
      data-map-status={mapStatus}
    >
      <div className="absolute inset-0" ref={containerRef} />

      <div className="absolute left-4 right-4 top-4 z-20 flex flex-wrap items-center justify-between gap-3">
        <div className="rounded-2xl border border-white/70 bg-card/90 px-4 py-3 shadow-lg backdrop-blur-xl dark:border-white/10">
          <p className="flex items-center gap-2 text-xs font-black text-foreground">
            {mode === "NEARBY" ? (
              <MapPin className="h-4 w-4 text-kondo-green" />
            ) : (
              <Compass className="h-4 w-4 text-kondo-green" />
            )}
            {areaLabel}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {profiles.length}{" "}
            {profiles.length === 1 ? "member discovered" : "members discovered"}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-card/90 px-3 py-2 text-[10px] font-bold text-muted-foreground shadow-lg backdrop-blur-xl dark:border-white/10">
          <ShieldCheck className="h-3.5 w-3.5 text-kondo-green" />
          Approximate areas · never exact
        </span>
      </div>

      {mapStatus === "loading" ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-card/70 backdrop-blur-sm">
          <p className="flex items-center gap-2 text-sm font-black">
            <LoaderCircle className="h-5 w-5 animate-spin text-kondo-green" />
            Loading real map…
          </p>
        </div>
      ) : null}

      {mapStatus === "unconfigured" || mapStatus === "error" ? (
        <div className="absolute inset-0 z-10 grid place-items-center px-6 pt-16">
          <div
            className="max-w-md rounded-[1.75rem] border border-border bg-card/95 p-6 text-center shadow-xl"
            role="alert"
          >
            <MapPin className="mx-auto h-8 w-8 text-kondo-green" />
            <h3 className="mt-4 font-black">Real map unavailable</h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {mapError}
            </p>
          </div>
        </div>
      ) : null}

      {mapStatus === "ready" && !profiles.length ? (
        <div className="absolute inset-0 z-10 grid place-items-center px-6 pt-16">
          <div className="max-w-sm rounded-[1.75rem] border border-white/70 bg-card/90 p-6 text-center shadow-xl backdrop-blur-xl dark:border-white/10">
            <Sparkles className="mx-auto h-7 w-7 text-kondo-green" />
            <h3 className="mt-4 font-black">
              No profile matches these filters
            </h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Try a broader campus or city range. Exact coordinates are never
              requested or displayed.
            </p>
          </div>
        </div>
      ) : null}

      <div aria-label="Map profile markers" className="sr-only" role="group">
        {profiles.map((profile) => (
          <button
            aria-label={`Preview ${maskedFirstName(profile.firstName)}`}
            key={profile.id}
            onClick={() => setSelected(profile)}
            type="button"
          />
        ))}
      </div>

      <AnimatePresence>
        {selected ? (
          <motion.article
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-x-3 bottom-3 z-30 rounded-[1.75rem] border border-white/70 bg-card/95 p-5 shadow-2xl backdrop-blur-xl dark:border-white/10 sm:inset-x-auto sm:bottom-5 sm:left-5 sm:w-[360px]"
            exit={{ opacity: 0, y: 16 }}
            initial={{ opacity: 0, y: 18 }}
          >
            <button
              aria-label="Close profile preview"
              className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition hover:bg-muted"
              onClick={() => setSelected(null)}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3 pr-8">
              <Avatar
                className="h-14 w-14 border-2 border-kondo-mint"
                firstName={selected.firstName}
                lastName={selected.lastName}
                mediaId={selected.avatarMediaId}
                seed={selected.id}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-lg font-black">
                    {maskedFirstName(selected.firstName)}
                    {selected.age ? `, ${selected.age}` : ""}
                  </h3>
                  {selected.official ? (
                    <OfficialMark
                      interactive={false}
                      organizationName={selected.official.organizationName}
                      organizationType={selected.official.organizationType}
                      size="sm"
                      verifiedAt={selected.official.verifiedAt}
                    />
                  ) : null}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {selected.distanceLabel ??
                    selected.university ??
                    selected.location?.city ??
                    "Kondo member"}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs text-muted-foreground">
              {selected.university ? (
                <p className="flex items-center gap-2">
                  <School className="h-3.5 w-3.5 text-kondo-green" />
                  {selected.university}
                </p>
              ) : null}
              {selected.languages.length ? (
                <p className="flex items-center gap-2">
                  <Languages className="h-3.5 w-3.5 text-kondo-green" />
                  {selected.languages.join(", ")}
                </p>
              ) : null}
              {selected.lookingFor.length ? (
                <p className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-kondo-green" />
                  {selected.lookingFor.map(intentLabel).join(" · ")}
                </p>
              ) : null}
              {selected.sharedInterests.length ? (
                <p className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-kondo-green" />
                  {selected.sharedInterests.join(" · ")} in common
                </p>
              ) : null}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {canViewFullProfile ? (
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/profile/${selected.username ?? selected.id}`}>
                    View profile
                  </Link>
                </Button>
              ) : (
                <Button
                  onClick={() =>
                    onPremiumRequest(
                      "Meet Premium unlocks complete profiles after you have experienced basic discovery.",
                    )
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <Crown className="h-4 w-4" />
                  Full profile
                </Button>
              )}
              {canConnect ? (
                <Button asChild size="sm">
                  <Link href={`/messages/new?recipient=${selected.id}`}>
                    <MessageCircle className="h-4 w-4" />
                    Connect
                  </Link>
                </Button>
              ) : (
                <Button
                  onClick={() =>
                    onPremiumRequest(
                      "Sending a connection request directly from the discovery map is a Meet Premium feature.",
                    )
                  }
                  size="sm"
                  type="button"
                >
                  <Crown className="h-4 w-4" />
                  Connect
                </Button>
              )}
            </div>
          </motion.article>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
