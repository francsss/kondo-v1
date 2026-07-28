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
  RefreshCw,
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
  baiduMapSdkUrl,
  hasRequiredBaiduMapConstructors,
} from "@/lib/baidu-map-readiness";
import {
  meetMapKnownAnchor,
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
type BaiduLocalResultPoi = {
  point?: BaiduPoint;
};
type BaiduLocalResult = {
  getPoi(index: number): BaiduLocalResultPoi | null;
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
  LocalSearch?: new (
    location: string,
    options: {
      pageCapacity?: number;
      onSearchComplete: (result: BaiduLocalResult | BaiduLocalResult[]) => void;
    },
  ) => {
    search(query: string, options?: { forceLocal?: boolean }): void;
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
    BMap?: unknown;
  }
}

let baiduLoader: Promise<BaiduMapsApi> | null = null;
const geocodeCache = new Map<string, BaiduPoint>();
const BAIDU_LOAD_TIMEOUT_MS = 15_000;
const BAIDU_LOAD_ATTEMPTS = 3;
const BAIDU_RETRY_DELAY_MS = 600;
const AREA_SEARCH_TIMEOUT_MS = 7_000;
const AREA_SEARCH_STAGGER_MS = 250;
const MAP_AVATAR_TIMEOUT_MS = 4_000;

function resolveMapAvatarUrl(profile: MeetDiscoveryProfile) {
  const fallback = defaultAvatarDataUri(
    profile.firstName,
    profile.lastName,
    profile.id,
  );
  if (!profile.avatarMediaId) return Promise.resolve(fallback);

  return new Promise<string>((resolve) => {
    const image = new window.Image();
    let settled = false;
    const finish = (url: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      resolve(url);
    };
    const timeout = window.setTimeout(
      () => finish(fallback),
      MAP_AVATAR_TIMEOUT_MS,
    );
    image.onload = () =>
      finish(
        image.naturalWidth > 0 && image.naturalHeight > 0
          ? `/api/media/${profile.avatarMediaId}`
          : fallback,
      );
    image.onerror = () => finish(fallback);
    image.src = `/api/media/${profile.avatarMediaId}`;
  });
}

function loadBaiduMaps(apiKey: string) {
  if (hasRequiredBaiduMapConstructors(window.BMap)) {
    return Promise.resolve(window.BMap as BaiduMapsApi);
  }
  if (baiduLoader) return baiduLoader;
  baiduLoader = new Promise<BaiduMapsApi>((resolve, reject) => {
    const existing = document.getElementById("kondo-baidu-map-script");
    let loadAttempt = 0;
    let retryTimer: number | null = null;
    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timeout);
      window.clearInterval(readinessPoll);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
    const complete = (api: BaiduMapsApi) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(api);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      baiduLoader = null;
      reject(error);
    };
    const timeout = window.setTimeout(() => {
      document.getElementById("kondo-baidu-map-script")?.remove();
      fail(new Error("Baidu Maps took too long to load."));
    }, BAIDU_LOAD_TIMEOUT_MS);
    const readinessPoll = window.setInterval(() => {
      if (hasRequiredBaiduMapConstructors(window.BMap)) {
        complete(window.BMap as BaiduMapsApi);
      }
    }, 100);
    existing?.remove();
    delete window.BMap;
    const appendScript = () => {
      loadAttempt += 1;
      const script = document.createElement("script");
      script.id = "kondo-baidu-map-script";
      script.async = true;
      script.defer = true;
      script.src = baiduMapSdkUrl(apiKey);
      script.onload = () => {
        if (hasRequiredBaiduMapConstructors(window.BMap)) {
          complete(window.BMap as BaiduMapsApi);
        }
      };
      script.onerror = () => {
        script.remove();
        if (loadAttempt < BAIDU_LOAD_ATTEMPTS) {
          retryTimer = window.setTimeout(
            appendScript,
            BAIDU_RETRY_DELAY_MS * loadAttempt,
          );
          return;
        }
        fail(new Error("Baidu Maps could not be loaded."));
      };
      document.head.appendChild(script);
    };
    appendScript();
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

function firstLocalSearchPoint(result: BaiduLocalResult | BaiduLocalResult[]) {
  const firstResult = Array.isArray(result) ? result[0] : result;
  return firstResult?.getPoi(0)?.point ?? null;
}

function locateStudyArea(
  api: BaiduMapsApi,
  mapQueries: string[],
  cityQueries: string[],
) {
  const queries = [...new Set(mapQueries.map((query) => query.trim()))].filter(
    Boolean,
  );
  const cities = [...new Set(cityQueries.map((city) => city.trim()))].filter(
    Boolean,
  );
  const cacheKey = `${queries.join("|").toLowerCase()}::${cities
    .join("|")
    .toLowerCase()}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);
  if (!queries.length) {
    return Promise.reject(new Error("The selected study area was not found."));
  }

  return new Promise<BaiduPoint>((resolve, reject) => {
    const geocoder = new api.Geocoder();
    const attemptTimers: number[] = [];
    let settled = false;
    const cleanup = () => {
      window.clearTimeout(deadline);
      attemptTimers.forEach((timer) => window.clearTimeout(timer));
    };
    const succeed = (point: BaiduPoint | null | undefined) => {
      if (settled || !point) return;
      settled = true;
      cleanup();
      if (geocodeCache.size >= 100) {
        const oldest = geocodeCache.keys().next().value;
        if (oldest) geocodeCache.delete(oldest);
      }
      geocodeCache.set(cacheKey, point);
      resolve(point);
    };
    const deadline = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Baidu Maps could not locate the selected study area."));
    }, AREA_SEARCH_TIMEOUT_MS);

    const attempts: Array<() => void> = [];
    const primaryCity = cities[0] ?? "China";

    const LocalSearch = api.LocalSearch;
    if (LocalSearch) {
      for (const query of queries.slice(0, 4)) {
        attempts.push(() => {
          const search = new LocalSearch(primaryCity, {
            pageCapacity: 1,
            onSearchComplete: (result) =>
              succeed(firstLocalSearchPoint(result)),
          });
          search.search(query, { forceLocal: true });
        });
      }
    }

    for (const city of cities) {
      attempts.push(() => {
        geocoder.getPoint(city, succeed, city);
      });
    }
    for (const query of queries.slice(0, 4)) {
      attempts.push(() => {
        geocoder.getPoint(query, succeed, primaryCity);
      });
    }

    for (const [index, attempt] of attempts.entries()) {
      const timer = window.setTimeout(() => {
        if (settled) return;
        try {
          attempt();
        } catch {
          // Continue through the remaining Baidu POI and geocoder fallbacks.
        }
      }, index * AREA_SEARCH_STAGGER_MS);
      attemptTimers.push(timer);
    }
  });
}

export function MeetDiscoveryMap({
  profiles,
  mode,
  areaLabel,
  mapQueries,
  cityQueries,
  distanceRange,
  premiumFeatures,
  onPremiumRequest,
}: {
  profiles: MeetDiscoveryProfile[];
  mode: "NEARBY" | "LOOKING_FOR";
  areaLabel: string;
  mapQueries: string[];
  cityQueries: string[];
  distanceRange: MeetMapDistance;
  premiumFeatures: string[];
  onPremiumRequest: (reason: string) => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_BAIDU_MAP_AK?.trim();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<MeetDiscoveryProfile | null>(null);
  const [mapStatus, setMapStatus] = useState<
    "loading" | "ready" | "unconfigured" | "error"
  >(!apiKey ? "unconfigured" : mapQueries.length ? "loading" : "error");
  const [mapError, setMapError] = useState(
    !apiKey
      ? "The real map is not configured yet. Add NEXT_PUBLIC_BAIDU_MAP_AK in Vercel Production."
      : mapQueries.length
        ? ""
        : "Choose a study university and city before opening the nearby map.",
  );
  const [mapAttempt, setMapAttempt] = useState(0);
  const canViewFullProfile = premiumFeatures.includes(
    MEET_PREMIUM_FEATURES.FULL_PROFILES,
  );
  const canConnect = premiumFeatures.includes(
    MEET_PREMIUM_FEATURES.MAP_CONNECTIONS,
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!apiKey || !container || !mapQueries.length) return;
    let cancelled = false;
    setMapStatus("loading");
    setMapError("");
    void loadBaiduMaps(apiKey)
      .then(async (api) => {
        if (cancelled) return;
        container.replaceChildren();
        const map = new api.Map(container, { enableMapClick: false });
        const knownAnchor = meetMapKnownAnchor(mapQueries);
        const anchor = knownAnchor
          ? new api.Point(knownAnchor.lng, knownAnchor.lat)
          : await locateStudyArea(api, mapQueries, cityQueries);
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
        setMapStatus("ready");
        const avatarUrls = await Promise.all(
          profiles.map((profile) => resolveMapAvatarUrl(profile)),
        );
        if (cancelled) return;
        for (const [index, profile] of profiles.entries()) {
          const coordinate = privacySafeMapCoordinate(
            anchor,
            profile.id,
            distanceRange,
          );
          const point = new api.Point(coordinate.lng, coordinate.lat);
          const size = new api.Size(48, 48);
          const icon = new api.Icon(
            avatarUrls[index] ??
              defaultAvatarDataUri(
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
      })
      .catch((error) => {
        if (cancelled) return;
        setMapStatus("error");
        setMapError(
          error instanceof Error
            ? `${error.message} Refresh the map or update your study area in Discovery Settings.`
            : "The real map could not be loaded.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey, cityQueries, distanceRange, mapAttempt, mapQueries, profiles]);

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
            {mapStatus === "error" ? (
              <Button
                className="mt-4"
                onClick={() => setMapAttempt((attempt) => attempt + 1)}
                size="sm"
                type="button"
                variant="secondary"
              >
                <RefreshCw className="h-4 w-4" />
                Retry map
              </Button>
            ) : null}
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
