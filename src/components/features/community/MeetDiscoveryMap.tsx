"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { Compass, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { OfficialMark } from "@/components/features/official-profile/OfficialMark";
import { Avatar } from "@/components/ui/Avatar";

export type MeetDiscoveryProfile = {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string;
  avatarMediaId: string | null;
  bio: string | null;
  lastActiveAt: string | null;
  location: {
    city: string | null;
    countryName: string | null;
    countryEmoji: string | null;
  } | null;
  university: string | null;
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

export function MeetDiscoveryMap({
  profiles,
  mode,
  areaLabel,
}: {
  profiles: MeetDiscoveryProfile[];
  mode: "NEARBY" | "LOOKING_FOR";
  areaLabel: string;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <section className="relative min-h-[430px] overflow-hidden rounded-[2rem] border border-border bg-[#eaf4ee] shadow-lift dark:bg-[#101f1b]">
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

      {profiles.map((profile, index) => {
        const position = positionFor(profile.id, index);
        return (
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="group absolute z-10 -translate-x-1/2 -translate-y-1/2"
            initial={{
              opacity: 0,
              scale: reducedMotion ? 1 : 0.7,
              y: reducedMotion ? 0 : 8,
            }}
            key={profile.id}
            style={{ left: `${position.left}%`, top: `${position.top}%` }}
            transition={{
              delay: reducedMotion ? 0 : Math.min(index * 0.045, 0.35),
              type: "spring",
              stiffness: 280,
              damping: 22,
            }}
          >
            <Link
              aria-label={`Open ${profile.firstName} ${profile.lastName}'s profile`}
              className="relative block rounded-full outline-none transition focus-visible:ring-4 focus-visible:ring-kondo-green/30"
              href={`/profile/${profile.username ?? profile.id}`}
            >
              <span className="absolute inset-0 animate-ping rounded-full bg-kondo-green/20 motion-reduce:animate-none" />
              <Avatar
                className="relative h-12 w-12 border-2 border-card shadow-[0_8px_24px_rgba(12,90,68,0.25)] transition duration-200 group-hover:-translate-y-1 group-hover:scale-110"
                firstName={profile.firstName}
                lastName={profile.lastName}
                mediaId={profile.avatarMediaId}
              />
              {profile.official ? (
                <OfficialMark
                  className="absolute -right-2 -top-2 z-20 bg-card shadow-sm"
                  interactive={false}
                  organizationName={profile.official.organizationName}
                  organizationType={profile.official.organizationType}
                  size="sm"
                  verifiedAt={profile.official.verifiedAt}
                />
              ) : null}
              <span className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] hidden w-max max-w-48 -translate-x-1/2 rounded-xl border border-border bg-card/95 px-3 py-2 text-center shadow-xl backdrop-blur group-hover:block group-focus-within:block">
                <span className="block text-xs font-black text-foreground">
                  {profile.firstName} {profile.lastName}
                </span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  {profile.university ??
                    profile.location?.city ??
                    "Kondo member"}
                </span>
              </span>
            </Link>
          </motion.div>
        );
      })}

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
              Try broader filters. Members only appear after choosing to be
              discoverable, and their exact position is never collected here.
            </p>
          </div>
        </div>
      ) : null}

      <div
        aria-hidden="true"
        className="absolute bottom-5 right-5 z-20 flex flex-col gap-1 rounded-xl border border-white/70 bg-card/90 p-1 shadow-lg backdrop-blur dark:border-white/10"
      >
        <span className="grid h-8 w-8 place-items-center text-lg font-bold text-foreground">
          +
        </span>
        <span className="h-px bg-border" />
        <span className="grid h-8 w-8 place-items-center text-lg font-bold text-foreground">
          −
        </span>
      </div>
    </section>
  );
}
