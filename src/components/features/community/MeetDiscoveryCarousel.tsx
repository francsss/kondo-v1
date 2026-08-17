"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  BookOpen,
  BriefcaseBusiness,
  Globe2,
  Heart,
  Languages,
  MapPin,
  MoveRight,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import type { MeetDiscoveryProfile } from "@/features/meet/types";
import { Avatar } from "@/components/ui/Avatar";
import { MEET_PREMIUM_FEATURES } from "@/features/meet/config";
import { cn } from "@/lib/utils";

const intentPresentation = {
  RELATIONSHIP: {
    label: "Meaningful connection",
    icon: Heart,
    accent:
      "from-rose-50 via-card to-amber-50/70 dark:from-rose-400/10 dark:via-card dark:to-amber-300/5",
  },
  FRIENDS: {
    label: "New friends",
    icon: UsersRound,
    accent:
      "from-sky-50 via-card to-emerald-50/70 dark:from-sky-400/10 dark:via-card dark:to-emerald-300/5",
  },
  STUDY: {
    label: "Study partner",
    icon: BookOpen,
    accent:
      "from-indigo-50 via-card to-sky-50/70 dark:from-indigo-400/10 dark:via-card dark:to-sky-300/5",
  },
  LANGUAGE: {
    label: "Language exchange",
    icon: Languages,
    accent:
      "from-violet-50 via-card to-cyan-50/70 dark:from-violet-400/10 dark:via-card dark:to-cyan-300/5",
  },
  CITY: {
    label: "Explore the city",
    icon: MapPin,
    accent:
      "from-emerald-50 via-card to-lime-50/70 dark:from-emerald-400/10 dark:via-card dark:to-lime-300/5",
  },
  SPORTS: {
    label: "Sports buddy",
    icon: Sparkles,
    accent:
      "from-orange-50 via-card to-lime-50/70 dark:from-orange-400/10 dark:via-card dark:to-lime-300/5",
  },
  NETWORKING: {
    label: "Professional networking",
    icon: BriefcaseBusiness,
    accent:
      "from-slate-50 via-card to-emerald-50/70 dark:from-slate-400/10 dark:via-card dark:to-emerald-300/5",
  },
  COUNTRY: {
    label: "People from my country",
    icon: Globe2,
    accent:
      "from-teal-50 via-card to-amber-50/70 dark:from-teal-400/10 dark:via-card dark:to-amber-300/5",
  },
} as const;

function maskedName(firstName: string, lastName: string) {
  const first = firstName.trim();
  const last = lastName.trim();
  const hidden = "*".repeat(Math.min(4, Math.max(2, first.length - 1)));
  return `${first.slice(0, 1)}${hidden} ${last.slice(0, 1)}.`;
}

export function MeetDiscoveryCarousel({
  profiles,
  activeIntent,
  loading,
  premiumFeatures,
  onPremiumRequest,
}: {
  profiles: MeetDiscoveryProfile[];
  activeIntent: string | null;
  loading: boolean;
  premiumFeatures: string[];
  onPremiumRequest: (reason: string) => void;
}) {
  const reducedMotion = useReducedMotion();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef(false);
  const canViewFullProfile = premiumFeatures.includes(
    MEET_PREMIUM_FEATURES.FULL_PROFILES,
  );
  const activePresentation =
    intentPresentation[activeIntent as keyof typeof intentPresentation] ??
    intentPresentation.FRIENDS;
  const ActiveIntentIcon = activePresentation.icon;

  useEffect(() => {
    if (reducedMotion || profiles.length < 2) return;
    const interval = window.setInterval(() => {
      const viewport = viewportRef.current;
      if (!viewport || pausedRef.current) return;
      const atEnd =
        viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 24;
      viewport.scrollTo({
        left: atEnd
          ? 0
          : viewport.scrollLeft + Math.min(300, viewport.clientWidth * 0.72),
        behavior: "smooth",
      });
    }, 3_200);
    return () => window.clearInterval(interval);
  }, [profiles.length, reducedMotion]);

  const cards = useMemo(
    () =>
      profiles.map((profile) => {
        const intent =
          (activeIntent && profile.lookingFor.includes(activeIntent)
            ? activeIntent
            : profile.lookingFor[0]) ?? "FRIENDS";
        const presentation =
          intentPresentation[intent as keyof typeof intentPresentation] ??
          intentPresentation.FRIENDS;
        return { profile, presentation };
      }),
    [activeIntent, profiles],
  );

  return (
    <section className="mx-auto mb-7 max-w-6xl" aria-label="Discovery matches">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-foreground">
            <ActiveIntentIcon className="h-4 w-4 text-kondo-green" />
            Discover people
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Personalized for {activePresentation.label.toLowerCase()}.
          </p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Drag to explore
        </span>
      </div>

      <div
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          pausedRef.current = false;
        }}
        onPointerDown={() => {
          pausedRef.current = true;
        }}
        onPointerUp={() => {
          pausedRef.current = false;
        }}
        ref={viewportRef}
      >
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div
                className="h-48 w-[245px] shrink-0 animate-pulse rounded-[1.75rem] border border-border bg-muted/70 sm:w-[275px]"
                key={index}
              />
            ))
          : null}

        {!loading && !cards.length ? (
          <div className="flex min-h-32 w-full items-center rounded-[1.75rem] border border-dashed border-border bg-muted/30 px-5">
            <div>
              <p className="text-sm font-black">
                Your next connection is joining.
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Broaden your preferences or return soon. Only members who opted
                into Meet appear here.
              </p>
            </div>
          </div>
        ) : null}

        {!loading
          ? cards.map(({ profile, presentation }, index) => {
              const Icon = presentation.icon;
              const content = (
                <motion.article
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "group relative h-48 w-[245px] shrink-0 snap-start overflow-hidden rounded-[1.75rem] border border-border bg-gradient-to-br p-4 text-left shadow-soft transition hover:-translate-y-1 hover:shadow-lift sm:w-[275px]",
                    presentation.accent,
                  )}
                  initial={{
                    opacity: 0,
                    y: reducedMotion ? 0 : 10,
                  }}
                  transition={{
                    delay: reducedMotion ? 0 : Math.min(index * 0.04, 0.28),
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <Avatar
                      className="h-14 w-14 border-2 border-card shadow-lg transition group-hover:scale-105"
                      firstName={profile.firstName}
                      lastName={profile.lastName}
                      mediaId={profile.avatarMediaId}
                      seed={profile.id}
                    />
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/80 px-2.5 py-1 text-[10px] font-black text-foreground backdrop-blur">
                      <Icon className="h-3 w-3 text-kondo-green" />
                      {presentation.label}
                    </span>
                  </div>
                  <p className="mt-4 truncate text-lg font-black tracking-tight">
                    {maskedName(profile.firstName, profile.lastName)}
                  </p>
                  {profile.gender || profile.age ? (
                    <p className="mt-1 truncate text-xs font-bold text-foreground/75">
                      {[
                        profile.gender === "MALE"
                          ? "Male"
                          : profile.gender === "FEMALE"
                            ? "Female"
                            : null,
                        profile.age,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                  <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">
                    {profile.distanceLabel ??
                      profile.university ??
                      "Kondo student"}
                  </p>
                  {profile.sharedInterests.length ? (
                    <p className="mt-3 truncate text-[11px] font-bold text-kondo-green">
                      {profile.sharedInterests.slice(0, 2).join(" · ")} in
                      common
                    </p>
                  ) : profile.languages.length ? (
                    <p className="mt-3 truncate text-[11px] font-bold text-kondo-green">
                      {profile.languages.slice(0, 2).join(" · ")}
                    </p>
                  ) : null}
                </motion.article>
              );

              return canViewFullProfile && profile.username ? (
                <Link
                  aria-label={`Open ${maskedName(profile.firstName, profile.lastName)}`}
                  href={`/profile/${profile.username}`}
                  key={profile.id}
                >
                  {content}
                </Link>
              ) : (
                <button
                  aria-label={`Preview ${maskedName(profile.firstName, profile.lastName)}`}
                  key={profile.id}
                  onClick={() =>
                    onPremiumRequest(
                      "Meet Premium unlocks complete profiles after basic discovery.",
                    )
                  }
                  type="button"
                >
                  {content}
                </button>
              );
            })
          : null}
        {!loading && cards.length ? (
          <button
            aria-label="Discover more people"
            className="group flex h-48 w-[210px] shrink-0 snap-start flex-col justify-between rounded-[1.75rem] border border-dashed border-kondo-green/35 bg-gradient-to-br from-kondo-mint/70 via-card to-card p-5 text-left shadow-soft transition hover:-translate-y-1 hover:border-kondo-green hover:shadow-lift dark:from-emerald-400/10 sm:w-[235px]"
            onClick={() =>
              onPremiumRequest(
                "Unlock more profiles, advanced filters, extended distance and additional discovery options.",
              )
            }
            type="button"
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-kondo-green text-white shadow-lg transition group-hover:scale-105">
              <MoveRight className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-lg font-black tracking-tight">
                Discover more people
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                More profiles and discovery options when you ask for them.
              </span>
            </span>
            <span className="text-xs font-black text-kondo-green">More →</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
