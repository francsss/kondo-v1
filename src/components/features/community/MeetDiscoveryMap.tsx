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
  type BaiduMapInstance,
  type BaiduMapsApi,
  type BaiduOverlay,
  type BaiduPoint,
  loadBaiduMapsSdk,
  logBaiduMapEvent,
  resetBaiduMapsSdkAfterFailure,
  waitForBaiduMapContainer,
  waitForBaiduMapRenderer,
} from "@/lib/baidu-map-sdk";
import {
  meetMapKnownAnchor,
  meetMapRadiusKm,
  meetMapZoom,
  privacySafeMapCoordinate,
  type MeetMapDistance,
} from "@/lib/meet-map";

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

export type MeetMapViewer = Pick<
  MeetDiscoveryProfile,
  "id" | "firstName" | "lastName" | "avatarMediaId"
>;

const geocodeCache = new Map<string, BaiduPoint>();
const MAP_AVATAR_TIMEOUT_MS = 4_000;

function resolveMapAvatarUrl(profile: MeetMapViewer): Promise<string | null> {
  if (!profile.avatarMediaId) return Promise.resolve(null);

  return new Promise<string | null>((resolve) => {
    const image = new window.Image();
    let settled = false;
    const finish = (url: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      resolve(url);
    };
    const timeout = window.setTimeout(
      () => finish(null),
      MAP_AVATAR_TIMEOUT_MS,
    );
    image.onload = () =>
      finish(
        image.naturalWidth > 0 && image.naturalHeight > 0
          ? `/api/media/${profile.avatarMediaId}`
          : null,
      );
    image.onerror = () => finish(null);
    image.src = `/api/media/${profile.avatarMediaId}`;
  });
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

async function locateStudyArea(
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
  if (cached) {
    logBaiduMapEvent("geocoder.cache_hit", { cacheKey });
    return cached;
  }
  if (!queries.length) {
    throw new Error("No study-area label was provided to Baidu Maps.");
  }

  const geocoder = new api.Geocoder();
  const primaryCity = cities[0] ?? "China";
  const attempts = [
    ...cities.map((city) => ({ query: city, city })),
    ...queries.map((query) => ({ query, city: primaryCity })),
  ].filter(
    (attempt, index, values) =>
      values.findIndex(
        (candidate) =>
          candidate.query === attempt.query && candidate.city === attempt.city,
      ) === index,
  );

  for (const [index, attempt] of attempts.entries()) {
    logBaiduMapEvent("geocoder.request", {
      attempt: index + 1,
      query: attempt.query,
      city: attempt.city,
    });
    try {
      const point = await new Promise<BaiduPoint | null>((resolve, reject) => {
        try {
          geocoder.getPoint(attempt.query, resolve, attempt.city);
        } catch (error) {
          reject(error);
        }
      });
      if (!point) {
        logBaiduMapEvent("geocoder.empty", {
          attempt: index + 1,
          query: attempt.query,
        });
        continue;
      }
      if (geocodeCache.size >= 100) {
        const oldest = geocodeCache.keys().next().value;
        if (oldest) geocodeCache.delete(oldest);
      }
      geocodeCache.set(cacheKey, point);
      logBaiduMapEvent("geocoder.resolved", {
        attempt: index + 1,
        query: attempt.query,
        coordinateSystem: "BD09",
      });
      return point;
    } catch (error) {
      console.error("[Kondo Meet Map]", "geocoder.request_failed", {
        attempt: index + 1,
        query: attempt.query,
        error,
      });
    }
  }

  throw new Error(
    "Baidu could not resolve the selected study area. Enable address geocoding for this browser AK or configure a verified BD-09 study-area anchor.",
  );
}

export function MeetDiscoveryMap({
  viewer,
  profiles,
  mode,
  areaLabel,
  mapQueries,
  cityQueries,
  distanceRange,
  premiumFeatures,
  onPremiumRequest,
}: {
  viewer: MeetMapViewer;
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
  const mapRef = useRef<BaiduMapInstance | null>(null);
  const apiRef = useRef<BaiduMapsApi | null>(null);
  const anchorRef = useRef<BaiduPoint | null>(null);
  const markerOverlaysRef = useRef<BaiduOverlay[]>([]);
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
  const [mapRevision, setMapRevision] = useState(0);
  const mapQueryKey = mapQueries.join("\u0001");
  const cityQueryKey = cityQueries.join("\u0001");
  const canViewFullProfile = premiumFeatures.includes(
    MEET_PREMIUM_FEATURES.FULL_PROFILES,
  );
  const canConnect = premiumFeatures.includes(
    MEET_PREMIUM_FEATURES.MAP_CONNECTIONS,
  );

  useEffect(() => {
    const container = containerRef.current;
    const activeMapQueries = mapQueryKey
      .split("\u0001")
      .filter((query) => query.length > 0);
    const activeCityQueries = cityQueryKey
      .split("\u0001")
      .filter((query) => query.length > 0);
    if (!apiKey || !container || !activeMapQueries.length) return;
    const controller = new AbortController();
    let localMap: BaiduMapInstance | null = null;
    let tilesLoadedListener: (() => void) | null = null;
    let styleLoadErrorListener: (() => void) | null = null;
    let styleLoadTimeoutListener: (() => void) | null = null;
    let mapFailed = false;
    setMapStatus("loading");
    setMapError("");

    void Promise.all([
      loadBaiduMapsSdk(apiKey),
      waitForBaiduMapContainer(container, controller.signal),
    ])
      .then(async ([api, measurement]) => {
        if (controller.signal.aborted || mapRef.current) return;
        container.replaceChildren();
        const map = new api.Map(container, { enableMapClick: false });
        localMap = map;
        mapRef.current = map;
        apiRef.current = api;
        logBaiduMapEvent("map.created", {
          width: Math.round(measurement.width),
          height: Math.round(measurement.height),
        });

        tilesLoadedListener = () => {
          if (controller.signal.aborted) return;
          logBaiduMapEvent("map.tiles_loaded");
        };
        map.addEventListener("tilesloaded", tilesLoadedListener);
        map.addEventListener("ontilesloaded", tilesLoadedListener);
        styleLoadErrorListener = () => {
          if (controller.signal.aborted) return;
          mapFailed = true;
          const message =
            "Baidu loaded the SDK but failed to load the map style.";
          console.error("[Kondo Meet Map]", "map.style_load_failed", {
            message,
          });
          setMapStatus("error");
          setMapError(message);
        };
        styleLoadTimeoutListener = () => {
          if (controller.signal.aborted) return;
          mapFailed = true;
          const message =
            "Baidu loaded the SDK but its map style service did not respond.";
          console.error("[Kondo Meet Map]", "map.style_load_timeout", {
            message,
          });
          setMapStatus("error");
          setMapError(message);
        };
        map.addEventListener("onstyle_loaded_error", styleLoadErrorListener);
        map.addEventListener(
          "onstyle_loaded_timeout",
          styleLoadTimeoutListener,
        );

        const knownAnchor = meetMapKnownAnchor(activeMapQueries);
        const anchor = knownAnchor
          ? new api.Point(knownAnchor.lng, knownAnchor.lat)
          : await locateStudyArea(api, activeMapQueries, activeCityQueries);
        if (controller.signal.aborted) return;
        anchorRef.current = anchor;
        logBaiduMapEvent("map.anchor_resolved", {
          source: knownAnchor ? "verified_anchor" : "baidu_geocoder",
          coordinateSystem: "BD09",
        });
        map.centerAndZoom(anchor, meetMapZoom(distanceRange));
        logBaiduMapEvent("map.center_set", {
          zoom: meetMapZoom(distanceRange),
          radiusKm: meetMapRadiusKm(distanceRange),
        });
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
        await waitForBaiduMapRenderer(map, container, controller.signal);
        if (controller.signal.aborted || mapFailed) return;
        setMapStatus("ready");
        setMapRevision((revision) => revision + 1);
      })
      .catch((error) => {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        console.error("[Kondo Meet Map]", "map.initialization_failed", error);
        setMapStatus("error");
        setMapError(
          error instanceof Error
            ? error.message
            : "Baidu Maps failed with an unknown initialization error.",
        );
      });

    return () => {
      controller.abort();
      if (localMap && tilesLoadedListener) {
        localMap.removeEventListener("tilesloaded", tilesLoadedListener);
        localMap.removeEventListener("ontilesloaded", tilesLoadedListener);
      }
      if (localMap && styleLoadErrorListener) {
        localMap.removeEventListener(
          "onstyle_loaded_error",
          styleLoadErrorListener,
        );
      }
      if (localMap && styleLoadTimeoutListener) {
        localMap.removeEventListener(
          "onstyle_loaded_timeout",
          styleLoadTimeoutListener,
        );
      }
      if (localMap) {
        localMap.clearOverlays();
        localMap.destroy?.();
        logBaiduMapEvent("map.cleanup");
      }
      if (mapRef.current === localMap) {
        mapRef.current = null;
        apiRef.current = null;
        anchorRef.current = null;
        markerOverlaysRef.current = [];
      }
    };
  }, [apiKey, cityQueryKey, distanceRange, mapAttempt, mapQueryKey]);

  useEffect(() => {
    const map = mapRef.current;
    const api = apiRef.current;
    const anchor = anchorRef.current;
    if (!map || !api || !anchor || !mapRevision) return;

    let cancelled = false;
    for (const overlay of markerOverlaysRef.current) {
      map.removeOverlay(overlay);
    }
    markerOverlaysRef.current = [];

    void Promise.all([
      resolveMapAvatarUrl(viewer),
      ...profiles.map((profile) => resolveMapAvatarUrl(profile)),
    ])
      .then(([viewerAvatarUrl, ...profileAvatarUrls]) => {
        if (cancelled || mapRef.current !== map) return;
        const overlays: BaiduOverlay[] = [];

        const viewerSize = new api.Size(54, 54);
        const viewerIcon = viewerAvatarUrl
          ? new api.Icon(viewerAvatarUrl, viewerSize, {
              imageSize: viewerSize,
              anchor: new api.Size(27, 27),
            })
          : undefined;
        const viewerMarker = new api.Marker(anchor, {
          icon: viewerIcon,
          title: "Your approximate study area",
        });
        const viewerLabel = new api.Label("You", {
          position: anchor,
          offset: new api.Size(18, -42),
        });
        viewerLabel.setStyle?.({
          background: "#063c31",
          border: "2px solid #ffffff",
          borderRadius: "999px",
          boxShadow: "0 6px 18px rgba(6, 60, 49, 0.24)",
          color: "#ffffff",
          fontSize: "11px",
          fontWeight: "800",
          lineHeight: "20px",
          padding: "0 8px",
          whiteSpace: "nowrap",
        });
        viewerMarker.setLabel?.(viewerLabel);
        map.addOverlay(viewerMarker);
        overlays.push(viewerMarker);

        for (const [index, profile] of profiles.entries()) {
          const coordinate = privacySafeMapCoordinate(
            anchor,
            profile.id,
            distanceRange,
          );
          const point = new api.Point(coordinate.lng, coordinate.lat);
          const size = new api.Size(48, 48);
          const avatarUrl = profileAvatarUrls[index];
          const icon = avatarUrl
            ? new api.Icon(avatarUrl, size, {
                imageSize: size,
                anchor: new api.Size(24, 24),
              })
            : undefined;
          const marker = new api.Marker(point, {
            icon,
            title: `Approximate area for ${maskedFirstName(profile.firstName)}`,
          });
          marker.addEventListener?.("click", () => setSelected(profile));
          map.addOverlay(marker);
          overlays.push(marker);
        }

        markerOverlaysRef.current = overlays;
        logBaiduMapEvent("markers.added", {
          currentUser: 1,
          nearbyUsers: profiles.length,
          coordinateSystem: "BD09",
        });
      })
      .catch((error) => {
        console.error("[Kondo Meet Map]", "markers.failed", error);
      });

    return () => {
      cancelled = true;
      for (const overlay of markerOverlaysRef.current) {
        map.removeOverlay(overlay);
      }
      markerOverlaysRef.current = [];
      logBaiduMapEvent("markers.cleanup");
    };
  }, [distanceRange, mapRevision, profiles, viewer]);

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
                onClick={() => {
                  resetBaiduMapsSdkAfterFailure();
                  setMapAttempt((attempt) => attempt + 1);
                }}
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
