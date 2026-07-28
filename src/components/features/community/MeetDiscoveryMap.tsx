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
  type BaiduMarker,
  type BaiduMapsApi,
  type BaiduOverlay,
  type BaiduPoint,
  inspectBaiduMapRenderer,
  loadBaiduMapsSdk,
  logBaiduMapEvent,
  observeBaiduMapResourceFailures,
  resetBaiduMapsSdkAfterFailure,
  waitForBaiduMapContainer,
  waitForBaiduMapRenderer,
} from "@/lib/baidu-map-sdk";
import {
  deduplicateMeetMapItems,
  isValidMeetMapCoordinate,
  JIAXING_UNIVERSITY_BD09,
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

function hydrateMarkerAvatar(
  api: BaiduMapsApi,
  marker: BaiduMarker,
  profile: MeetMapViewer,
  sizePixels: number,
  signal: AbortSignal,
) {
  if (!profile.avatarMediaId || !marker.setIcon) return () => {};

  const image = new window.Image();
  const avatarUrl = `/api/media/${profile.avatarMediaId}`;
  const cleanup = () => {
    image.onload = null;
    image.onerror = null;
    signal.removeEventListener("abort", cleanup);
  };
  image.onload = () => {
    if (signal.aborted) return;
    const size = new api.Size(sizePixels, sizePixels);
    marker.setIcon?.(
      new api.Icon(avatarUrl, size, {
        imageSize: size,
        anchor: new api.Size(sizePixels / 2, sizePixels / 2),
      }),
    );
    cleanup();
    logBaiduMapEvent("marker.avatar_loaded", {
      profileId: profile.id,
    });
  };
  image.onerror = () => {
    cleanup();
    console.error("[Kondo Meet Map]", "marker.avatar_failed", {
      profileId: profile.id,
    });
  };
  signal.addEventListener("abort", cleanup, { once: true });
  image.src = avatarUrl;
  return cleanup;
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
  showEmptyState,
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
  showEmptyState?: boolean;
  premiumFeatures: string[];
  onPremiumRequest: (reason: string) => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_BAIDU_MAP_AK?.trim();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<BaiduMapInstance | null>(null);
  const apiRef = useRef<BaiduMapsApi | null>(null);
  const anchorRef = useRef<BaiduPoint | null>(null);
  const areaOverlayRef = useRef<BaiduOverlay | null>(null);
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
  const [tileStatus, setTileStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
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
    let resourceFailureReported = false;
    const stopObservingResources = observeBaiduMapResourceFailures(
      controller.signal,
      (message) => {
        if (controller.signal.aborted) return;
        resourceFailureReported = true;
        setTileStatus("error");
        setMapStatus("error");
        setMapError(message);
      },
    );
    let localMap: BaiduMapInstance | null = null;
    let tilesLoadedListener: (() => void) | null = null;
    let styleLoadErrorListener: (() => void) | null = null;
    let styleLoadTimeoutListener: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame = 0;
    setMapStatus("loading");
    setTileStatus("loading");
    setMapError("");

    void Promise.all([
      loadBaiduMapsSdk(apiKey),
      waitForBaiduMapContainer(container, controller.signal),
    ])
      .then(async ([api, measurement]) => {
        if (controller.signal.aborted || mapRef.current) return;
        container.replaceChildren();
        const knownAnchor = meetMapKnownAnchor(activeMapQueries);
        const initialCoordinate = knownAnchor ?? JIAXING_UNIVERSITY_BD09;
        const initialPoint = new api.Point(
          initialCoordinate.lng,
          initialCoordinate.lat,
        );
        const zoom = meetMapZoom("CITY");
        const map = new api.Map(container, {
          enableAutoResize: true,
          enableMapClick: false,
          enableWheelZoom: true,
        });
        localMap = map;
        mapRef.current = map;
        apiRef.current = api;
        logBaiduMapEvent("map.created", {
          initialized: map.isLoaded?.() ?? true,
          width: Math.round(measurement.width),
          height: Math.round(measurement.height),
        });

        tilesLoadedListener = () => {
          if (controller.signal.aborted) return;
          logBaiduMapEvent("map.tiles_loaded", {
            ...inspectBaiduMapRenderer(map, container),
          });
        };
        map.addEventListener("tilesloaded", tilesLoadedListener);
        styleLoadErrorListener = () => {
          if (controller.signal.aborted) return;
          const message =
            "Baidu loaded the SDK but failed to load the map style.";
          console.error("[Kondo Meet Map]", "map.style_load_failed", {
            message,
          });
          resourceFailureReported = true;
          setTileStatus("error");
          setMapStatus("error");
          setMapError(message);
        };
        styleLoadTimeoutListener = () => {
          if (controller.signal.aborted) return;
          const message =
            "Baidu loaded the SDK but its map style service did not respond.";
          console.error("[Kondo Meet Map]", "map.style_load_timeout", {
            message,
          });
          resourceFailureReported = true;
          setTileStatus("error");
          setMapStatus("error");
          setMapError(message);
        };
        map.addEventListener("style_loaded_error", styleLoadErrorListener);
        map.addEventListener("style_loaded_timeout", styleLoadTimeoutListener);
        const rendererReady = waitForBaiduMapRenderer(
          map,
          container,
          controller.signal,
        );

        map.centerAndZoom(initialPoint, zoom);
        logBaiduMapEvent("map.center_set", {
          source: knownAnchor ? "verified_anchor" : "startup_anchor",
          coordinateSystem: "BD09",
          zoom,
          radiusKm: meetMapRadiusKm("CITY"),
        });
        map.enableScrollWheelZoom();
        map.addControl(new api.NavigationControl());
        map.addControl(new api.ScaleControl());
        map.checkResize?.();

        const finishAnchor = (
          anchor: BaiduPoint,
          source: "startup_anchor" | "verified_anchor" | "baidu_geocoder",
        ) => {
          if (controller.signal.aborted || mapRef.current !== map) return;
          if (!isValidMeetMapCoordinate(anchor)) {
            console.error("[MeetMap]", "anchor.invalid", { source });
            return;
          }
          anchorRef.current = anchor;
          logBaiduMapEvent("map.anchor_resolved", {
            source,
            coordinateSystem: "BD09",
          });
          setMapRevision((revision) => revision + 1);
        };

        finishAnchor(
          initialPoint,
          knownAnchor ? "verified_anchor" : "startup_anchor",
        );

        if (!knownAnchor) {
          void locateStudyArea(api, activeMapQueries, activeCityQueries)
            .then((geocodedAnchor) => {
              finishAnchor(geocodedAnchor, "baidu_geocoder");
            })
            .catch((error) => {
              console.error("[MeetMap]", "map.anchor_failed", error);
            });
        }

        if (typeof ResizeObserver === "function") {
          resizeObserver = new ResizeObserver(() => {
            if (controller.signal.aborted || mapRef.current !== map) return;
            if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
            resizeFrame = window.requestAnimationFrame(() => {
              map.checkResize?.();
              logBaiduMapEvent("map.resize_completed", {
                height: Math.round(container.getBoundingClientRect().height),
                width: Math.round(container.getBoundingClientRect().width),
              });
            });
          });
          resizeObserver.observe(container);
        }

        const renderer = await rendererReady;
        if (controller.signal.aborted || resourceFailureReported) return;
        setTileStatus("loaded");
        setMapStatus("ready");
        logBaiduMapEvent("map.visible", renderer);
      })
      .catch((error) => {
        if (
          controller.signal.aborted ||
          resourceFailureReported ||
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
      stopObservingResources();
      resizeObserver?.disconnect();
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      if (localMap && tilesLoadedListener) {
        localMap.removeEventListener("tilesloaded", tilesLoadedListener);
      }
      if (localMap && styleLoadErrorListener) {
        localMap.removeEventListener(
          "style_loaded_error",
          styleLoadErrorListener,
        );
      }
      if (localMap && styleLoadTimeoutListener) {
        localMap.removeEventListener(
          "style_loaded_timeout",
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
        areaOverlayRef.current = null;
        markerOverlaysRef.current = [];
      }
    };
  }, [apiKey, cityQueryKey, mapAttempt, mapQueryKey]);

  useEffect(() => {
    const map = mapRef.current;
    const api = apiRef.current;
    const anchor = anchorRef.current;
    if (!map || !api || !anchor || !mapRevision) return;

    if (areaOverlayRef.current) {
      map.removeOverlay(areaOverlayRef.current);
    }
    const zoom = meetMapZoom(distanceRange);
    const radiusKm = meetMapRadiusKm(distanceRange);
    const circle = new api.Circle(anchor, radiusKm * 1_000, {
      strokeColor: "#16a36a",
      strokeWeight: 1,
      strokeOpacity: 0.48,
      fillColor: "#34d399",
      fillOpacity: 0.08,
    });
    areaOverlayRef.current = circle;
    map.centerAndZoom(anchor, zoom);
    map.addOverlay(circle);
    const resizeFrame = window.requestAnimationFrame(() => {
      map.checkResize?.();
    });
    logBaiduMapEvent("map.center_updated", {
      coordinateSystem: "BD09",
      radiusKm,
      zoom,
    });

    return () => {
      window.cancelAnimationFrame(resizeFrame);
      if (areaOverlayRef.current === circle) {
        map.removeOverlay(circle);
        areaOverlayRef.current = null;
      }
    };
  }, [distanceRange, mapRevision]);

  useEffect(() => {
    const map = mapRef.current;
    const api = apiRef.current;
    const anchor = anchorRef.current;
    if (!map || !api || !anchor || !mapRevision) return;

    const controller = new AbortController();
    const avatarCleanups: Array<() => void> = [];
    for (const overlay of markerOverlaysRef.current) {
      map.removeOverlay(overlay);
    }
    markerOverlaysRef.current = [];

    const overlays: BaiduOverlay[] = [];
    try {
      const viewerMarker = new api.Marker(anchor, {
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
      avatarCleanups.push(
        hydrateMarkerAvatar(api, viewerMarker, viewer, 54, controller.signal),
      );

      const uniqueProfiles = deduplicateMeetMapItems(profiles);
      for (const profile of uniqueProfiles) {
        const coordinate = privacySafeMapCoordinate(
          anchor,
          profile.id,
          distanceRange,
        );
        if (!isValidMeetMapCoordinate(coordinate)) {
          console.error("[MeetMap]", "marker.invalid_coordinate", {
            profileId: profile.id,
          });
          continue;
        }
        const point = new api.Point(coordinate.lng, coordinate.lat);
        const marker = new api.Marker(point, {
          title: `Approximate area for ${maskedFirstName(profile.firstName)}`,
        });
        const label = new api.Label(maskedFirstName(profile.firstName), {
          position: point,
          offset: new api.Size(14, -36),
        });
        label.setStyle?.({
          background: "rgba(255,255,255,.94)",
          border: "1px solid rgba(6,60,49,.18)",
          borderRadius: "999px",
          boxShadow: "0 5px 14px rgba(6,60,49,.14)",
          color: "#063c31",
          fontSize: "10px",
          fontWeight: "800",
          lineHeight: "18px",
          padding: "0 7px",
          whiteSpace: "nowrap",
        });
        marker.setLabel?.(label);
        marker.addEventListener?.("click", () => setSelected(profile));
        map.addOverlay(marker);
        overlays.push(marker);
        avatarCleanups.push(
          hydrateMarkerAvatar(api, marker, profile, 48, controller.signal),
        );
      }

      markerOverlaysRef.current = overlays;
      logBaiduMapEvent("markers.added", {
        currentUser: 1,
        nearbyUsers: overlays.length - 1,
        coordinateSystem: "BD09",
      });
    } catch (error) {
      console.error("[Kondo Meet Map]", "markers.failed", error);
    }

    return () => {
      controller.abort();
      for (const cleanupAvatar of avatarCleanups) cleanupAvatar();
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
      data-map-tiles={tileStatus}
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

      {mapStatus === "ready" && showEmptyState && !profiles.length ? (
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
