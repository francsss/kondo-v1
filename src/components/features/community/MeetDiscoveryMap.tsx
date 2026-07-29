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
import { useEffect, useMemo, useRef, useState } from "react";
import { OfficialMark } from "@/components/features/official-profile/OfficialMark";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { MEET_PREMIUM_FEATURES } from "@/features/meet/config";
import {
  createConfiguredMeetMapProvider,
  isMeetMapProviderConfigured,
  MEET_MAP_MISSING_CONFIGURATION_MESSAGE,
  MEET_MAP_PROVIDER_ID,
  type MapController,
  type MapCoordinate,
  type MapProvider,
} from "@/lib/maps";
import { logMapEvent, waitForMapContainer } from "@/lib/maps/provider";
import {
  approximateDistanceMeters,
  DEFAULT_MEET_NEARBY_RADIUS_METERS,
  deduplicateMeetMapItems,
  friendlyApproximateDistance,
  isValidMeetMapCoordinate,
  JIAXING_UNIVERSITY_WGS84,
  meetMapKnownAnchor,
  meetMapZoom,
  privacySafeMapCoordinate,
  privacySafeViewerCoordinate,
  type MeetNearbyRadiusMeters,
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

type PositionedProfile = {
  coordinate: MapCoordinate;
  distanceLabel: string;
  distanceMeters: number;
  profile: MeetDiscoveryProfile;
};

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

export function MeetDiscoveryMap({
  viewer,
  profiles,
  mode,
  areaLabel,
  mapQueries,
  radiusMeters,
  showEmptyState,
  premiumFeatures,
  onPremiumRequest,
}: {
  viewer: MeetMapViewer;
  profiles: MeetDiscoveryProfile[];
  mode: "NEARBY" | "LOOKING_FOR";
  areaLabel: string;
  mapQueries: string[];
  radiusMeters: MeetNearbyRadiusMeters;
  showEmptyState?: boolean;
  premiumFeatures: string[];
  onPremiumRequest: (reason: string) => void;
}) {
  const mapProviderConfigured = isMeetMapProviderConfigured();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const providerRef = useRef<MapProvider | null>(null);
  const mapRef = useRef<MapController | null>(null);
  const anchorRef = useRef<MapCoordinate | null>(null);
  const [selected, setSelected] = useState<MeetDiscoveryProfile | null>(null);
  const [mapStatus, setMapStatus] = useState<
    "loading" | "ready" | "unconfigured" | "error"
  >(
    !mapProviderConfigured
      ? "unconfigured"
      : mapQueries.length
        ? "loading"
        : "error",
  );
  const [mapError, setMapError] = useState(
    !mapProviderConfigured
      ? MEET_MAP_MISSING_CONFIGURATION_MESSAGE
      : mapQueries.length
        ? ""
        : "Choose a study university and city before opening the nearby map.",
  );
  const [mapAttempt, setMapAttempt] = useState(0);
  const [mapRevision, setMapRevision] = useState(0);
  const mapQueryKey = mapQueries.join("\u0001");
  const knownAnchor = useMemo(
    () => meetMapKnownAnchor(mapQueries),
    [mapQueries],
  );
  const [geocodedAnchor, setGeocodedAnchor] = useState<{
    coordinate: MapCoordinate;
    queryKey: string;
  } | null>(null);
  const resolvedAnchor =
    geocodedAnchor?.queryKey === mapQueryKey ? geocodedAnchor.coordinate : null;
  const activeAnchor =
    knownAnchor ?? resolvedAnchor ?? JIAXING_UNIVERSITY_WGS84;
  const viewerCoordinate = useMemo(
    () => privacySafeViewerCoordinate(activeAnchor, viewer.id),
    [activeAnchor, viewer.id],
  );
  const positionedProfiles = useMemo(() => {
    return deduplicateMeetMapItems(profiles)
      .map((profile): PositionedProfile => {
        const coordinate = privacySafeMapCoordinate(activeAnchor, profile.id);
        const distanceMeters = approximateDistanceMeters(
          viewerCoordinate,
          coordinate,
        );
        return {
          coordinate,
          distanceLabel: friendlyApproximateDistance(distanceMeters),
          distanceMeters,
          profile,
        };
      })
      .filter(({ distanceMeters }) => distanceMeters <= radiusMeters)
      .sort((first, second) => first.distanceMeters - second.distanceMeters);
  }, [activeAnchor, profiles, radiusMeters, viewerCoordinate]);
  const selectedPosition = selected
    ? positionedProfiles.find(({ profile }) => profile.id === selected.id)
    : null;
  const visibleSelected = selectedPosition?.profile ?? null;
  const canViewFullProfile = premiumFeatures.includes(
    MEET_PREMIUM_FEATURES.FULL_PROFILES,
  );
  const canConnect = premiumFeatures.includes(
    MEET_PREMIUM_FEATURES.MAP_CONNECTIONS,
  );

  useEffect(() => {
    const container = containerRef.current;
    const activeQueries = mapQueryKey
      .split("\u0001")
      .filter((query) => query.length > 0);
    if (!mapProviderConfigured || !container || !activeQueries.length) return;
    const controller = new AbortController();
    const provider = createConfiguredMeetMapProvider();
    providerRef.current = provider;
    let localMap: MapController | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame = 0;
    setMapStatus("loading");
    setMapError("");

    void waitForMapContainer(container, controller.signal)
      .then(async (containerSize) => {
        if (controller.signal.aborted || mapRef.current) return;
        const startupAnchor =
          meetMapKnownAnchor(activeQueries) ?? JIAXING_UNIVERSITY_WGS84;
        const map = await provider.createMap(container, {
          center: startupAnchor,
          onError: (error) => {
            if (controller.signal.aborted) return;
            console.error("[MeetMap]", "map.provider_failed", error);
            setMapStatus("error");
            setMapError(error.message);
          },
          onReady: () => {
            if (!controller.signal.aborted) {
              logMapEvent("map.tiles_visible", { provider: provider.id });
            }
          },
          zoom: meetMapZoom(DEFAULT_MEET_NEARBY_RADIUS_METERS),
        });
        if (controller.signal.aborted) {
          map.destroy();
          return;
        }
        localMap = map;
        mapRef.current = map;
        anchorRef.current = startupAnchor;
        setMapRevision((revision) => revision + 1);
        setMapStatus("ready");
        logMapEvent("map.visible", {
          height: Math.round(containerSize.height),
          provider: provider.id,
          width: Math.round(containerSize.width),
        });

        if (!meetMapKnownAnchor(activeQueries)) {
          void provider.geocode(activeQueries).then((coordinate) => {
            if (
              controller.signal.aborted ||
              mapRef.current !== map ||
              !coordinate ||
              !isValidMeetMapCoordinate(coordinate)
            ) {
              return;
            }
            anchorRef.current = coordinate;
            setGeocodedAnchor({ coordinate, queryKey: mapQueryKey });
            map.setViewport({
              center: coordinate,
              zoom: meetMapZoom(DEFAULT_MEET_NEARBY_RADIUS_METERS),
            });
            setMapRevision((revision) => revision + 1);
          });
        }

        if (typeof ResizeObserver === "function") {
          resizeObserver = new ResizeObserver(() => {
            if (controller.signal.aborted || mapRef.current !== map) return;
            if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
            resizeFrame = window.requestAnimationFrame(() => map.resize());
          });
          resizeObserver.observe(container);
        }
      })
      .catch((cause) => {
        if (
          controller.signal.aborted ||
          (cause instanceof DOMException && cause.name === "AbortError")
        ) {
          return;
        }
        console.error("[MeetMap]", "map.initialization_failed", cause);
        setMapStatus("error");
        setMapError(
          cause instanceof Error
            ? cause.message
            : "The map provider failed with an unknown initialization error.",
        );
      });

    return () => {
      controller.abort();
      resizeObserver?.disconnect();
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      localMap?.destroy();
      if (mapRef.current === localMap) {
        mapRef.current = null;
        anchorRef.current = null;
      }
      if (providerRef.current === provider) providerRef.current = null;
    };
  }, [mapAttempt, mapProviderConfigured, mapQueryKey]);

  useEffect(() => {
    const map = mapRef.current;
    const anchor = anchorRef.current;
    if (!map || !anchor || !mapRevision) return;
    map.setViewport({ center: anchor, zoom: meetMapZoom(radiusMeters) });
    map.setRadius(anchor, radiusMeters);
    logMapEvent("map.radius_updated", { radiusMeters });
  }, [mapRevision, radiusMeters]);

  useEffect(() => {
    const map = mapRef.current;
    const anchor = anchorRef.current;
    if (!map || !anchor || !mapRevision) return;
    const markers = [
      {
        coordinate: anchor,
        id: "university-center",
        label: "Campus",
        title: "Public university center",
        variant: "university" as const,
      },
      {
        avatarUrl: viewer.avatarMediaId
          ? `/api/media/${viewer.avatarMediaId}`
          : undefined,
        coordinate: privacySafeViewerCoordinate(anchor, viewer.id),
        id: `viewer:${viewer.id}`,
        label: "You",
        title: "Your approximate campus area",
        variant: "current" as const,
      },
      ...positionedProfiles.map(({ coordinate, distanceLabel, profile }) => ({
        avatarUrl: profile.avatarMediaId
          ? `/api/media/${profile.avatarMediaId}`
          : undefined,
        coordinate,
        distanceLabel,
        id: profile.id,
        label: maskedFirstName(profile.firstName),
        onClick: () => setSelected(profile),
        title: `${maskedFirstName(profile.firstName)} · ${distanceLabel} · approximate area`,
        variant: "member" as const,
      })),
    ];
    map.setMarkers(markers);
  }, [mapRevision, positionedProfiles, viewer]);

  return (
    <section
      aria-label="Nearby discovery map"
      className="relative min-h-[480px] overflow-hidden rounded-[2rem] border border-border bg-muted shadow-lift"
      data-map-provider={MEET_MAP_PROVIDER_ID}
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
            {positionedProfiles.length}{" "}
            {positionedProfiles.length === 1
              ? "member within range"
              : `members within ${radiusMeters < 1000 ? `${radiusMeters} m` : `${radiusMeters / 1000} km`}`}
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
                  providerRef.current?.retryAfterFailure();
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

      {mapStatus === "ready" && showEmptyState && !positionedProfiles.length ? (
        <div className="absolute inset-0 z-10 grid place-items-center px-6 pt-16">
          <div className="max-w-sm rounded-[1.75rem] border border-white/70 bg-card/90 p-6 text-center shadow-xl backdrop-blur-xl dark:border-white/10">
            <Sparkles className="mx-auto h-7 w-7 text-kondo-green" />
            <h3 className="mt-4 font-black">
              No one is inside this radius yet
            </h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Try a wider campus radius. Every marker remains deliberately
              approximate.
            </p>
          </div>
        </div>
      ) : null}

      <div aria-label="Map profile markers" className="sr-only" role="group">
        {positionedProfiles.map(({ distanceLabel, profile }) => (
          <button
            aria-label={`Preview ${maskedFirstName(profile.firstName)}, ${distanceLabel}`}
            key={profile.id}
            onClick={() => setSelected(profile)}
            type="button"
          />
        ))}
      </div>

      <AnimatePresence>
        {visibleSelected ? (
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
                firstName={visibleSelected.firstName}
                lastName={visibleSelected.lastName}
                mediaId={visibleSelected.avatarMediaId}
                seed={visibleSelected.id}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-lg font-black">
                    {maskedFirstName(visibleSelected.firstName)}
                    {visibleSelected.age ? `, ${visibleSelected.age}` : ""}
                  </h3>
                  {visibleSelected.official ? (
                    <OfficialMark
                      interactive={false}
                      organizationName={
                        visibleSelected.official.organizationName
                      }
                      organizationType={
                        visibleSelected.official.organizationType
                      }
                      size="sm"
                      verifiedAt={visibleSelected.official.verifiedAt}
                    />
                  ) : null}
                </div>
                <p className="truncate text-xs font-bold text-kondo-green">
                  {selectedPosition?.distanceLabel ??
                    visibleSelected.distanceLabel ??
                    "Approximate campus area"}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs text-muted-foreground">
              {visibleSelected.university ? (
                <p className="flex items-center gap-2">
                  <School className="h-3.5 w-3.5 text-kondo-green" />
                  {visibleSelected.university}
                </p>
              ) : null}
              {visibleSelected.languages.length ? (
                <p className="flex items-center gap-2">
                  <Languages className="h-3.5 w-3.5 text-kondo-green" />
                  {visibleSelected.languages.join(", ")}
                </p>
              ) : null}
              {visibleSelected.lookingFor.length ? (
                <p className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-kondo-green" />
                  {visibleSelected.lookingFor.map(intentLabel).join(" · ")}
                </p>
              ) : null}
              {visibleSelected.sharedInterests.length ? (
                <p className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-kondo-green" />
                  {visibleSelected.sharedInterests.join(" · ")} in common
                </p>
              ) : null}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {canViewFullProfile ? (
                <Button asChild size="sm" variant="secondary">
                  <Link
                    href={`/profile/${visibleSelected.username ?? visibleSelected.id}`}
                  >
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
                  <Link href={`/messages/new?recipient=${visibleSelected.id}`}>
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
