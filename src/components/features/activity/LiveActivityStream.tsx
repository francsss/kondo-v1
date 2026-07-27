"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Award,
  Building2,
  CalendarDays,
  FileText,
  Heart,
  MessageCircle,
  Sparkles,
  Store,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import type {
  HomeActivityItem,
  HomeActivityType,
} from "@/features/activity/types";
import { cn } from "@/lib/utils";

const activityAppearance: Record<
  HomeActivityType,
  {
    label: string;
    icon: LucideIcon;
    iconClass: string;
    washClass: string;
  }
> = {
  MEMBER_JOINED: {
    label: "New member",
    icon: UserPlus,
    iconClass:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
    washClass: "from-emerald-500/12",
  },
  POST_CREATED: {
    label: "New post",
    icon: FileText,
    iconClass:
      "bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
    washClass: "from-blue-500/12",
  },
  COMMENT_CREATED: {
    label: "Conversation",
    icon: MessageCircle,
    iconClass:
      "bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
    washClass: "from-violet-500/12",
  },
  COMMUNITY_JOINED: {
    label: "Community",
    icon: Users,
    iconClass:
      "bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300",
    washClass: "from-cyan-500/12",
  },
  COMMUNITY_CREATED: {
    label: "New community",
    icon: Sparkles,
    iconClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
    washClass: "from-amber-500/12",
  },
  CITY_HUB_PUBLISHED: {
    label: "Explore",
    icon: Building2,
    iconClass:
      "bg-teal-100 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300",
    washClass: "from-teal-500/12",
  },
  LISTING_CREATED: {
    label: "Marketplace",
    icon: Store,
    iconClass:
      "bg-orange-100 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
    washClass: "from-orange-500/12",
  },
  EVENT_UPCOMING: {
    label: "Upcoming",
    icon: CalendarDays,
    iconClass:
      "bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
    washClass: "from-rose-500/12",
  },
  FOLLOW_CREATED: {
    label: "New connection",
    icon: Heart,
    iconClass:
      "bg-pink-100 text-pink-700 dark:bg-pink-400/15 dark:text-pink-300",
    washClass: "from-pink-500/12",
  },
  BADGE_EARNED: {
    label: "Achievement",
    icon: Award,
    iconClass:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-400/15 dark:text-yellow-300",
    washClass: "from-yellow-500/12",
  },
};

function compactRelativeTime(value: string, now: number) {
  const elapsed = Math.max(0, now - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function LiveActivityStream({
  initialActivities,
  generatedAt,
}: {
  initialActivities: HomeActivityItem[];
  generatedAt: string;
}) {
  const reducedMotion = useReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(initialActivities);
  const scrollFrame = useRef<number | null>(null);
  const [activities, setActivities] = useState(initialActivities);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [now, setNow] = useState(() => new Date(generatedAt).getTime());
  const paused = hovered || focused || interacting;

  const scrollToActivity = useCallback(
    (index: number) => {
      const viewport = viewportRef.current;
      if (!viewport || !activities.length) return;
      const normalized = (index + activities.length) % activities.length;
      const card = viewport.querySelector<HTMLElement>(
        `[data-activity-index="${normalized}"]`,
      );
      if (!card) return;
      viewport.scrollTo({
        behavior: reducedMotion ? "auto" : "smooth",
        left:
          card.offsetLeft -
          Math.max(0, (viewport.clientWidth - card.clientWidth) / 2),
      });
      setActiveIndex(normalized);
    },
    [activities.length, reducedMotion],
  );

  useEffect(() => {
    const relativeClock = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(relativeClock);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || activities.length < 2) return;
    const autoplay = window.setInterval(
      () => scrollToActivity(activeIndex + 1),
      3_400,
    );
    return () => window.clearInterval(autoplay);
  }, [activeIndex, activities.length, paused, reducedMotion, scrollToActivity]);

  useEffect(() => {
    const refresh = window.setInterval(async () => {
      if (document.hidden) return;
      const response = await fetch("/api/activity", {
        cache: "no-store",
        credentials: "include",
      }).catch(() => null);
      const data = await response?.json().catch(() => null);
      if (!response?.ok || !Array.isArray(data?.activities)) return;
      const next = data.activities as HomeActivityItem[];
      const hasNewLead = next[0]?.id !== itemsRef.current[0]?.id;
      itemsRef.current = next;
      setActivities(next);
      if (hasNewLead) {
        setActiveIndex(0);
        window.requestAnimationFrame(() => scrollToActivity(0));
      }
    }, 30_000);
    return () => window.clearInterval(refresh);
  }, [scrollToActivity]);

  function updateActiveCard() {
    if (scrollFrame.current !== null) return;
    scrollFrame.current = window.requestAnimationFrame(() => {
      scrollFrame.current = null;
      const viewport = viewportRef.current;
      if (!viewport) return;
      const center = viewport.scrollLeft + viewport.clientWidth / 2;
      const cards = Array.from(
        viewport.querySelectorAll<HTMLElement>("[data-activity-index]"),
      );
      let closest = 0;
      let distance = Number.POSITIVE_INFINITY;
      cards.forEach((card, index) => {
        const cardCenter = card.offsetLeft + card.clientWidth / 2;
        const nextDistance = Math.abs(cardCenter - center);
        if (nextDistance < distance) {
          closest = index;
          distance = nextDistance;
        }
      });
      setActiveIndex(closest);
    });
  }

  if (!activities.length) {
    return (
      <section className="relative overflow-hidden rounded-[1.75rem] border border-emerald-200/70 bg-card p-5 shadow-soft dark:border-emerald-400/15 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-kondo-green opacity-35" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-kondo-green" />
          </span>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
            Kondo live
          </p>
        </div>
        <h2 className="mt-2 text-xl font-black tracking-tight text-kondo-ink dark:text-white">
          The next story starts here.
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          New members, conversations and communities will appear here as Kondo
          grows.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="live-activity-title"
      className="noise relative overflow-hidden rounded-[1.75rem] border border-emerald-200/70 bg-gradient-to-br from-white via-emerald-50/45 to-white shadow-[0_22px_70px_rgba(20,71,58,0.12)] dark:border-emerald-400/15 dark:from-[#14221e] dark:via-[#112c24] dark:to-[#14211e]"
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        aria-hidden="true"
        className="absolute -right-28 -top-36 h-80 w-80 rounded-full bg-kondo-lime/25 blur-3xl dark:bg-emerald-400/10"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-44 left-1/4 h-72 w-72 rounded-full bg-sky-200/30 blur-3xl dark:bg-cyan-400/5"
      />

      <div className="relative px-4 pb-2 pt-4 sm:px-5 sm:pt-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-kondo-green opacity-35" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-kondo-green" />
            </span>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-kondo-green">
              Kondo live
            </p>
            <span className="rounded-full border border-emerald-200/80 bg-white/70 px-2 py-0.5 text-[10px] font-bold text-emerald-800 backdrop-blur dark:border-emerald-400/15 dark:bg-white/5 dark:text-emerald-200">
              {activities.length} recent moments
            </span>
          </div>
          <h2
            className="mt-1.5 text-xl font-black tracking-[-0.035em] text-kondo-ink dark:text-white sm:text-2xl"
            id="live-activity-title"
          >
            Kondo is moving.
          </h2>
          <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground sm:text-sm">
            People are joining, sharing and building their lives across China.
          </p>
        </div>
      </div>

      <div className="relative">
        <div
          aria-label="Recent activity"
          className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 pt-1 sm:px-5"
          onPointerCancel={() => setInteracting(false)}
          onPointerDown={() => setInteracting(true)}
          onPointerUp={() => setInteracting(false)}
          onScroll={updateActiveCard}
          onWheel={(event) => {
            const viewport = viewportRef.current;
            if (!viewport || Math.abs(event.deltaX) >= Math.abs(event.deltaY))
              return;
            const canMoveLeft = event.deltaY < 0 && viewport.scrollLeft > 0;
            const canMoveRight =
              event.deltaY > 0 &&
              viewport.scrollLeft <
                viewport.scrollWidth - viewport.clientWidth - 1;
            if (!canMoveLeft && !canMoveRight) return;
            event.preventDefault();
            viewport.scrollLeft += event.deltaY;
          }}
          ref={viewportRef}
          role="list"
          tabIndex={0}
        >
          {activities.map((activity, index) => {
            const appearance = activityAppearance[activity.type];
            const Icon = appearance.icon;
            const active = index === activeIndex;
            return (
              <motion.article
                animate={{ opacity: active ? 1 : 0.72, y: 0 }}
                className={cn(
                  "relative w-[80vw] max-w-[330px] shrink-0 snap-center overflow-hidden rounded-[1.35rem] border bg-card/90 p-4 shadow-sm backdrop-blur-xl transition-[border-color,box-shadow,transform] duration-500 sm:w-[330px]",
                  active
                    ? "-translate-y-1 border-emerald-300/90 shadow-[0_22px_55px_rgba(20,71,58,0.14)] dark:border-emerald-400/30"
                    : "border-border/80",
                )}
                data-activity-index={index}
                initial={reducedMotion ? false : { opacity: 0, y: 14 }}
                key={activity.id}
                role="listitem"
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent",
                    appearance.washClass,
                  )}
                />
                <Link
                  aria-label={`Open activity: ${activity.action}${activity.subject ? ` ${activity.subject}` : ""}`}
                  className="relative block focus-visible:rounded-2xl"
                  href={activity.href}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                      <span
                        className={cn(
                          "grid h-7 w-7 place-items-center rounded-lg",
                          appearance.iconClass,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {appearance.label}
                    </span>
                    <time
                      className="rounded-full bg-muted/80 px-2.5 py-1 text-[10px] font-bold text-muted-foreground"
                      dateTime={activity.occurredAt}
                      title={new Date(activity.occurredAt).toLocaleString()}
                    >
                      {compactRelativeTime(activity.occurredAt, now)}
                    </time>
                  </div>

                  <div className="mt-4 flex items-start gap-3">
                    {activity.actor ? (
                      <Avatar
                        className="h-10 w-10 text-xs ring-[3px] ring-white shadow-md dark:ring-[#1b2b26]"
                        firstName={activity.actor.firstName}
                        lastName={activity.actor.lastName}
                        mediaId={activity.actor.avatarMediaId}
                        seed={activity.actor.id}
                      />
                    ) : (
                      <span
                        aria-label="Kondo"
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-kondo-forest to-emerald-500 text-xs font-black text-white ring-[3px] ring-white shadow-md dark:ring-[#1b2b26]"
                        role="img"
                      >
                        K
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-5 text-muted-foreground">
                        {activity.actor ? (
                          <strong className="font-black text-kondo-ink dark:text-white">
                            {activity.actor.firstName} {activity.actor.lastName}
                            {activity.actor.countryEmoji ? (
                              <span className="ml-1.5" role="img">
                                {activity.actor.countryEmoji}
                              </span>
                            ) : null}
                          </strong>
                        ) : null}{" "}
                        <span>{activity.action}</span>{" "}
                        {activity.subject ? (
                          <strong className="font-bold text-kondo-ink dark:text-white">
                            “{activity.subject}”
                          </strong>
                        ) : null}
                      </p>
                      {activity.detail ? (
                        <p className="mt-1.5 line-clamp-1 text-xs leading-4 text-muted-foreground/85">
                          {activity.detail}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </motion.article>
            );
          })}
          <div aria-hidden="true" className="w-1 shrink-0" />
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-7 bg-gradient-to-r from-white/90 to-transparent dark:from-[#14221e]/90"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-7 bg-gradient-to-l from-white/90 to-transparent dark:from-[#14221e]/90"
        />
      </div>

      <div
        className="relative flex items-center gap-1.5 px-5 pb-4"
        aria-hidden="true"
      >
        {activities.slice(0, 8).map((activity, index) => (
          <span
            className={cn(
              "h-1 rounded-full transition-all duration-500",
              index === activeIndex
                ? "w-7 bg-kondo-green"
                : "w-2 bg-slate-300 dark:bg-white/15",
            )}
            key={activity.id}
          />
        ))}
        {activities.length > 8 ? (
          <span className="ml-1 text-[10px] font-bold text-muted-foreground">
            +{activities.length - 8}
          </span>
        ) : null}
      </div>
    </section>
  );
}
