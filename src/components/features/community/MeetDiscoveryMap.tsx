"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import {
  Compass,
  Crown,
  Languages,
  MapPin,
  MessageCircle,
  School,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { OfficialMark } from "@/components/features/official-profile/OfficialMark";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { MEET_PREMIUM_FEATURES } from "@/features/meet/config";

export type MeetDiscoveryProfile = {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string;
  avatarMediaId: string | null;
  bio: string | null;
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

const positions = [
  [14, 21],
  [34, 14],
  [57, 22],
  [79, 15],
  [23, 43],
  [47, 48],
  [72, 41],
  [88, 54],
  [12, 68],
  [36, 73],
  [61, 68],
  [80, 79],
] as const;

function positionFor(id: string, index: number) {
  let hash = 0;
  for (const character of id) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  const base = positions[index % positions.length];
  const cycle = Math.floor(index / positions.length);
  return {
    left: Math.min(91, Math.max(9, base[0] + ((hash % 7) - 3) + cycle * 2)),
    top: Math.min(
      84,
      Math.max(12, base[1] + (((hash >> 3) % 7) - 3) - cycle * 2),
    ),
  };
}

function markerClusters(profiles: MeetDiscoveryProfile[]) {
  const clusters = new Map<
    string,
    {
      left: number;
      top: number;
      profiles: MeetDiscoveryProfile[];
    }
  >();
  profiles.forEach((profile, index) => {
    const position = positionFor(profile.id, index);
    const key = `${Math.round(position.left / 12)}:${Math.round(
      position.top / 12,
    )}`;
    const cluster = clusters.get(key);
    if (cluster) {
      cluster.profiles.push(profile);
      cluster.left =
        (cluster.left * (cluster.profiles.length - 1) + position.left) /
        cluster.profiles.length;
      cluster.top =
        (cluster.top * (cluster.profiles.length - 1) + position.top) /
        cluster.profiles.length;
    } else {
      clusters.set(key, {
        left: position.left,
        top: position.top,
        profiles: [profile],
      });
    }
  });
  return [...clusters.values()];
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

export function MeetDiscoveryMap({
  profiles,
  mode,
  areaLabel,
  premiumFeatures,
  onPremiumRequest,
}: {
  profiles: MeetDiscoveryProfile[];
  mode: "NEARBY" | "LOOKING_FOR";
  areaLabel: string;
  premiumFeatures: string[];
  onPremiumRequest: (reason: string) => void;
}) {
  const reducedMotion = useReducedMotion();
  const [selected, setSelected] = useState<MeetDiscoveryProfile | null>(null);
  const clusters = useMemo(() => markerClusters(profiles), [profiles]);
  const canViewFullProfile = premiumFeatures.includes(
    MEET_PREMIUM_FEATURES.FULL_PROFILES,
  );
  const canConnect = premiumFeatures.includes(
    MEET_PREMIUM_FEATURES.MAP_CONNECTIONS,
  );

  return (
    <section
      aria-label="Nearby discovery map"
      className="relative min-h-[480px] overflow-hidden rounded-[2rem] border border-border bg-[#eaf4ee] shadow-lift dark:bg-[#101f1b]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-80 dark:opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(34deg, transparent 46%, rgba(255,255,255,.8) 47%, rgba(255,255,255,.8) 51%, transparent 52%), linear-gradient(122deg, transparent 46%, rgba(255,255,255,.65) 47%, rgba(255,255,255,.65) 50%, transparent 51%), radial-gradient(circle at 30% 30%, rgba(74,222,128,.22), transparent 30%), radial-gradient(circle at 75% 70%, rgba(45,212,191,.2), transparent 28%)",
          backgroundSize: "180px 160px, 220px 190px, 100% 100%, 100% 100%",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(rgb(var(--border)/0.15)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--border)/0.15)_1px,transparent_1px)] bg-[size:34px_34px]"
      />

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
          Approximate map · never exact
        </span>
      </div>

      {clusters.map((cluster, index) => (
        <motion.button
          animate={{ opacity: 1, scale: 1, y: 0 }}
          aria-label={
            cluster.profiles.length === 1
              ? `Preview ${maskedFirstName(cluster.profiles[0]!.firstName)}`
              : `Preview ${cluster.profiles.length} nearby members`
          }
          className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:ring-4 focus-visible:ring-kondo-green/30"
          initial={{
            opacity: 0,
            scale: reducedMotion ? 1 : 0.7,
            y: reducedMotion ? 0 : 8,
          }}
          key={cluster.profiles.map((profile) => profile.id).join(":")}
          onClick={() => setSelected(cluster.profiles[0] ?? null)}
          style={{ left: `${cluster.left}%`, top: `${cluster.top}%` }}
          transition={{
            delay: reducedMotion ? 0 : Math.min(index * 0.045, 0.35),
            type: "spring",
            stiffness: 280,
            damping: 22,
          }}
          type="button"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-kondo-green/15 motion-reduce:animate-none" />
          <span className="relative flex -space-x-3">
            {cluster.profiles.slice(0, 3).map((profile) => (
              <Avatar
                className="h-12 w-12 border-2 border-card shadow-[0_8px_24px_rgba(12,90,68,0.25)] transition duration-200 group-hover:-translate-y-1 group-hover:scale-105"
                firstName={profile.firstName}
                key={profile.id}
                lastName={profile.lastName}
                mediaId={profile.avatarMediaId}
              />
            ))}
          </span>
          {cluster.profiles.length > 1 ? (
            <span className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full border-2 border-card bg-kondo-ink px-1 text-[10px] font-black text-white">
              {cluster.profiles.length}
            </span>
          ) : cluster.profiles[0]?.official ? (
            <OfficialMark
              className="absolute -right-2 -top-2 z-20 bg-card shadow-sm"
              interactive={false}
              organizationName={cluster.profiles[0].official.organizationName}
              organizationType={cluster.profiles[0].official.organizationType}
              size="sm"
              verifiedAt={cluster.profiles[0].official.verifiedAt}
            />
          ) : null}
        </motion.button>
      ))}

      {!profiles.length ? (
        <div className="absolute inset-0 z-10 grid place-items-center px-6 pt-16">
          <div className="max-w-sm rounded-[1.75rem] border border-white/70 bg-card/90 p-6 text-center shadow-xl backdrop-blur-xl dark:border-white/10">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
              <Sparkles className="h-5 w-5" />
            </span>
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
