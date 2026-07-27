"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bookmark,
  Check,
  ChevronRight,
  CircleHelp,
  Flag,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Play,
  RefreshCw,
  Share2,
  SignalLow,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { OfficialMark } from "@/components/features/official-profile/OfficialMark";
import { StoryCommentsSheet } from "@/components/features/stories/StoryCommentsSheet";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import type { StoryFeedItem } from "@/lib/stories";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { cn } from "@/lib/utils";

type PlaybackPreference = "autoplay" | "data-saver";

function initialPlaybackPreference(): PlaybackPreference | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem("kondo-story-playback");
  if (stored === "autoplay" || stored === "data-saver") return stored;
  return null;
}

function networkMode() {
  if (typeof navigator === "undefined") return "unknown";
  const connection = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean };
    }
  ).connection;
  if (connection?.saveData) return "save-data";
  return connection?.effectiveType ?? (navigator.onLine ? "online" : "offline");
}

export function StoryReader({
  initialStories,
  returnTo,
  entryPoint,
}: {
  initialStories: StoryFeedItem[];
  returnTo?: string;
  entryPoint?: string;
}) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef(new Map<number, HTMLVideoElement>());
  const sectionRefs = useRef(new Map<number, HTMLElement>());
  const started = useRef(new Set<string>());
  const completed = useRef(new Set<string>());
  const opened = useRef(new Set<string>());
  const lastActiveIndex = useRef(0);
  const [stories, setStories] = useState(initialStories);
  const [activeIndex, setActiveIndex] = useState(0);
  const [preference, setPreference] = useState<PlaybackPreference | null>(null);
  const [playbackReady, setPlaybackReady] = useState(false);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [commentsStory, setCommentsStory] = useState<StoryFeedItem | null>(
    null,
  );
  const [menuStoryId, setMenuStoryId] = useState<string | null>(null);
  const [whyStory, setWhyStory] = useState<StoryFeedItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadErrors, setLoadErrors] = useState<Set<string>>(new Set());
  const [online, setOnline] = useState(true);

  const current = stories[activeIndex];
  const announcement = current
    ? `${current.title}. Story ${activeIndex + 1} of ${stories.length}.`
    : "";
  const autoplayEnabled = preference === "autoplay" && !reducedMotion;

  const leave = useCallback(() => {
    const source = returnTo?.startsWith("/") ? returnTo : "/home";
    if (window.history.length > 1) router.back();
    else router.push(source);
  }, [returnTo, router]);

  const moveTo = useCallback(
    (index: number) => {
      const next = Math.min(stories.length - 1, Math.max(0, index));
      sectionRefs.current.get(next)?.scrollIntoView({
        block: "start",
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [reducedMotion, stories.length],
  );

  useEffect(() => {
    const previousIndex = lastActiveIndex.current;
    if (previousIndex !== activeIndex) {
      const previousStory = stories[previousIndex];
      const previousVideo = videoRefs.current.get(previousIndex);
      if (
        previousStory &&
        previousVideo &&
        !completed.current.has(previousStory.id)
      ) {
        const percentage = previousStory.durationSeconds
          ? Math.min(
              100,
              Math.round(
                (previousVideo.currentTime / previousStory.durationSeconds) *
                  100,
              ),
            )
          : 0;
        captureProductEvent(PRODUCT_EVENTS.STORY_SKIPPED, {
          story_id: previousStory.id,
          watch_time_seconds: Math.round(previousVideo.currentTime),
          completion_percentage: percentage,
        });
      }
      lastActiveIndex.current = activeIndex;
    }
  }, [activeIndex, stories]);

  useEffect(() => {
    const preferenceTimer = window.setTimeout(() => {
      const stored = initialPlaybackPreference();
      if (stored) setPreference(stored);
      setPlaybackReady(true);
    }, 0);
    return () => window.clearTimeout(preferenceTimer);
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const initialTimer = window.setTimeout(update, 0);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.clearTimeout(initialTimer);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) => right.intersectionRatio - left.intersectionRatio,
          )[0];
        if (!visible) return;
        const index = Number((visible.target as HTMLElement).dataset.index);
        if (Number.isFinite(index)) setActiveIndex(index);
      },
      { root, threshold: [0.55, 0.72, 0.9] },
    );
    for (const section of sectionRefs.current.values())
      observer.observe(section);
    return () => observer.disconnect();
  }, [stories.length]);

  useEffect(() => {
    for (const [index, video] of videoRefs.current) {
      if (index !== activeIndex) {
        video.pause();
        continue;
      }
      if (autoplayEnabled && !paused) {
        video.play().catch(() => setPaused(true));
      } else {
        video.pause();
      }
    }
    if (!current) return;
    if (!opened.current.has(current.id)) {
      opened.current.add(current.id);
      captureProductEvent(PRODUCT_EVENTS.STORY_OPENED, {
        story_id: current.id,
        creator_id: current.creator.id,
        category_id: current.category.id,
        duration_seconds: current.durationSeconds,
        entry_point: entryPoint ?? (returnTo ? "contextual" : "secondary_menu"),
        recommendation_reason: current.recommendationReason,
        network_mode: networkMode(),
        autoplay_enabled: autoplayEnabled,
        is_official: current.creator.official,
        is_featured: current.isFeatured,
      });
    }
  }, [
    activeIndex,
    autoplayEnabled,
    current,
    entryPoint,
    paused,
    returnTo,
    stories.length,
  ]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (commentsStory || whyStory) return;
      if (event.key === "Escape") leave();
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveTo(activeIndex + 1);
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveTo(activeIndex - 1);
      }
      if (event.key === " ") {
        event.preventDefault();
        setPaused((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, commentsStory, leave, moveTo, whyStory]);

  useEffect(() => {
    if (!current) return;
    const nextVideo = videoRefs.current.get(activeIndex);
    if (!nextVideo) return;
    if (paused) nextVideo.pause();
    else if (autoplayEnabled) nextVideo.play().catch(() => setPaused(true));
  }, [activeIndex, autoplayEnabled, current, paused]);

  function choosePreference(value: PlaybackPreference) {
    window.localStorage.setItem("kondo-story-playback", value);
    setPreference(value);
    setPaused(value === "data-saver");
  }

  function onPlaying(story: StoryFeedItem) {
    if (!started.current.has(story.id)) {
      started.current.add(story.id);
      captureProductEvent(PRODUCT_EVENTS.STORY_STARTED, {
        story_id: story.id,
        duration_seconds: story.durationSeconds,
        network_mode: networkMode(),
        autoplay_enabled: autoplayEnabled,
      });
    }
    setPaused(false);
  }

  function onEnded(story: StoryFeedItem) {
    if (!completed.current.has(story.id)) {
      completed.current.add(story.id);
      captureProductEvent(PRODUCT_EVENTS.STORY_COMPLETED, {
        story_id: story.id,
        duration_seconds: story.durationSeconds,
        completion_percentage: 100,
      });
    }
    moveTo(activeIndex + 1);
  }

  async function toggleInteraction(
    story: StoryFeedItem,
    action: "LIKE" | "SAVE",
  ) {
    const key = action === "LIKE" ? "liked" : "saved";
    const active = !story.viewer[key];
    setStories((items) =>
      items.map((item) =>
        item.id === story.id
          ? {
              ...item,
              viewer: { ...item.viewer, [key]: active },
              counts: {
                ...item.counts,
                [action === "LIKE" ? "likes" : "saves"]:
                  item.counts[action === "LIKE" ? "likes" : "saves"] +
                  (active ? 1 : -1),
              },
            }
          : item,
      ),
    );
    const response = await fetch(`/api/stories/${story.id}/interactions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, active }),
    }).catch(() => null);
    if (!response?.ok) {
      setStories((items) =>
        items.map((item) =>
          item.id === story.id
            ? { ...item, viewer: { ...item.viewer, [key]: !active } }
            : item,
        ),
      );
      return;
    }
    captureProductEvent(
      action === "LIKE"
        ? active
          ? PRODUCT_EVENTS.STORY_LIKED
          : PRODUCT_EVENTS.STORY_UNLIKED
        : active
          ? PRODUCT_EVENTS.STORY_SAVED
          : PRODUCT_EVENTS.STORY_UNSAVED,
      { story_id: story.id, category_id: story.category.id },
    );
  }

  async function shareStory(story: StoryFeedItem) {
    const url = new URL(story.href, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({
          title: story.title,
          text: story.description,
          url,
        });
        captureProductEvent(PRODUCT_EVENTS.STORY_SHARED, {
          story_id: story.id,
          method: "native",
        });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
    captureProductEvent(PRODUCT_EVENTS.STORY_SHARED, {
      story_id: story.id,
      method: "copy",
    });
  }

  async function hideStory(story: StoryFeedItem) {
    await fetch(`/api/stories/${story.id}/interactions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "HIDE",
        active: true,
        reason: "not_relevant",
      }),
    }).catch(() => null);
    setStories((items) => items.filter((item) => item.id !== story.id));
    setMenuStoryId(null);
  }

  if (!stories.length) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-kondo-ink p-6 text-white">
        <div className="max-w-md text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/10 text-3xl">
            🌱
          </span>
          <h1 className="mt-6 text-3xl font-black tracking-tight">
            Useful stories are on the way
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/65">
            Kondo will show videos here when they match your city, university,
            communities or practical interests.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button
              className="bg-white text-kondo-ink hover:bg-kondo-lime"
              onClick={leave}
              type="button"
            >
              Back to Kondo
            </Button>
            <Button asChild variant="secondary">
              <Link href="/stories/submit">Submit a Story</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-[#071813] text-white">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-5">
        <Button
          aria-label="Return to the previous page"
          className="pointer-events-auto border-white/15 bg-black/30 text-white backdrop-blur-md hover:bg-black/50 hover:text-white"
          onClick={leave}
          size="icon"
          type="button"
          variant="secondary"
        >
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        </Button>
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-2 text-[11px] font-black uppercase tracking-[0.13em] text-white/80 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-kondo-lime" />
          Student Stories
        </div>
        <Button
          aria-label={muted ? "Turn sound on" : "Mute video"}
          className="pointer-events-auto border-white/15 bg-black/30 text-white backdrop-blur-md hover:bg-black/50 hover:text-white"
          onClick={() => setMuted((value) => !value)}
          size="icon"
          type="button"
          variant="secondary"
        >
          {muted ? (
            <VolumeX aria-hidden="true" className="h-5 w-5" />
          ) : (
            <Volume2 aria-hidden="true" className="h-5 w-5" />
          )}
        </Button>
      </header>

      <div
        className="scrollbar-none h-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain"
        ref={containerRef}
      >
        {stories.map((story, index) => {
          const active = index === activeIndex;
          const shouldLoad = Math.abs(index - activeIndex) <= 1;
          const hasError = loadErrors.has(story.id);
          return (
            <section
              aria-label={`${story.title}, ${index + 1} of ${stories.length}`}
              className="relative grid h-[100dvh] snap-start snap-always place-items-center overflow-hidden lg:grid-cols-[minmax(0,1fr)_360px]"
              data-index={index}
              key={story.id}
              ref={(node) => {
                if (node) sectionRefs.current.set(index, node);
                else sectionRefs.current.delete(index);
              }}
            >
              <div className="relative h-full w-full overflow-hidden bg-black lg:m-4 lg:h-[calc(100dvh-2rem)] lg:max-w-[760px] lg:rounded-[2rem]">
                {story.posterUrl ? (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 scale-110 bg-cover bg-center opacity-35 blur-2xl"
                    style={{ backgroundImage: `url("${story.posterUrl}")` }}
                  />
                ) : null}
                {shouldLoad && !hasError ? (
                  <video
                    aria-label={story.title}
                    className="relative h-full w-full object-contain"
                    controls={false}
                    crossOrigin="anonymous"
                    loop={false}
                    muted={muted}
                    onClick={() => setPaused((value) => !value)}
                    onEnded={() => onEnded(story)}
                    onError={() =>
                      setLoadErrors((values) => new Set(values).add(story.id))
                    }
                    onPause={() => {
                      if (active) setPaused(true);
                    }}
                    onPlaying={() => onPlaying(story)}
                    playsInline
                    poster={story.posterUrl ?? undefined}
                    preload={active ? "auto" : "metadata"}
                    ref={(node) => {
                      if (node) videoRefs.current.set(index, node);
                      else videoRefs.current.delete(index);
                    }}
                    src={story.videoUrl}
                  >
                    {story.captions ? (
                      <track
                        default
                        kind="captions"
                        label="Captions"
                        src={`/api/stories/${story.id}/captions`}
                        srcLang={story.language.slice(0, 2)}
                      />
                    ) : null}
                  </video>
                ) : hasError ? (
                  <div className="relative grid h-full place-items-center p-6 text-center">
                    <div>
                      <SignalLow
                        aria-hidden="true"
                        className="mx-auto h-10 w-10 text-kondo-lime"
                      />
                      <p className="mt-4 font-black">Video could not load</p>
                      <p className="mt-2 text-sm text-white/60">
                        Check your connection, then retry this Story.
                      </p>
                      <Button
                        className="mt-5 bg-white text-kondo-ink"
                        onClick={() => {
                          setLoadErrors((values) => {
                            const next = new Set(values);
                            next.delete(story.id);
                            return next;
                          });
                        }}
                        size="sm"
                        type="button"
                      >
                        <RefreshCw aria-hidden="true" className="h-4 w-4" />
                        Retry
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="relative h-full w-full bg-black" />
                )}

                {active && paused && !hasError ? (
                  <button
                    aria-label="Play Story"
                    className="absolute inset-0 grid place-items-center"
                    onClick={() => setPaused(false)}
                    type="button"
                  >
                    <span className="grid h-16 w-16 place-items-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md">
                      <Play
                        aria-hidden="true"
                        className="ml-1 h-7 w-7"
                        fill="currentColor"
                      />
                    </span>
                  </button>
                ) : null}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/65 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 z-10 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
                  <div className="max-w-[calc(100%-4.5rem)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-kondo-lime backdrop-blur-md">
                        {story.category.icon} {story.category.name}
                      </span>
                      {story.isInstitutional ? (
                        <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]">
                          Official information
                        </span>
                      ) : null}
                      {story.isSponsored ? (
                        <span className="text-[10px] font-bold text-white/60">
                          Sponsored
                        </span>
                      ) : null}
                    </div>
                    <h1 className="mt-3 text-balance text-2xl font-black leading-tight tracking-[-0.035em] sm:text-3xl">
                      {story.title}
                    </h1>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/72">
                      {story.description}
                    </p>
                    <div className="mt-4 flex items-center gap-2.5">
                      <Link
                        aria-label={`Open ${story.creator.name}'s profile`}
                        className="flex min-w-0 items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kondo-lime"
                        href={story.creator.profileHref}
                        onClick={() =>
                          captureProductEvent(
                            PRODUCT_EVENTS.CREATOR_PROFILE_OPENED,
                            {
                              story_id: story.id,
                              creator_id: story.creator.id,
                            },
                          )
                        }
                      >
                        <Avatar
                          className={cn(
                            "h-9 w-9 ring-black/30",
                            story.creator.official &&
                              "ring-[3px] ring-kondo-lime/80",
                          )}
                          firstName={story.creator.name.split(" ")[0] ?? ""}
                          lastName={
                            story.creator.name.split(" ").slice(1).join(" ") ||
                            "Member"
                          }
                          mediaId={story.creator.avatarMediaId}
                          seed={story.creator.id}
                        />
                        <span className="truncate text-sm font-black">
                          {story.creator.name}
                        </span>
                      </Link>
                      {story.creator.official ? (
                        <OfficialMark
                          organizationName={
                            story.creator.officialOrganizationName
                          }
                          organizationType={
                            story.creator.officialOrganizationType
                          }
                          verifiedAt={story.creator.officialVerifiedAt}
                        />
                      ) : null}
                      {story.creator.trusted ? (
                        <span className="rounded-full border border-white/15 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white/70">
                          Trusted creator
                        </span>
                      ) : null}
                    </div>
                    {story.links[0]?.href ? (
                      <Link
                        className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-kondo-lime px-4 text-xs font-black text-kondo-forest transition hover:bg-white"
                        href={story.links[0].href}
                        onClick={() =>
                          captureProductEvent(
                            PRODUCT_EVENTS.STORY_ENTITY_CLICKED,
                            {
                              story_id: story.id,
                              associated_entity_type: story.links[0].type,
                              associated_entity_id: story.links[0].entityId,
                            },
                          )
                        }
                      >
                        {story.links[0].actionLabel}
                        <ChevronRight aria-hidden="true" className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </div>

                  <div className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-3 flex flex-col items-center gap-2 sm:right-5">
                    <StoryAction
                      active={story.viewer.liked}
                      count={story.counts.likes}
                      icon={Heart}
                      label={story.viewer.liked ? "Unlike Story" : "Like Story"}
                      onClick={() => toggleInteraction(story, "LIKE")}
                    />
                    <StoryAction
                      count={story.counts.comments}
                      icon={MessageCircle}
                      label="Open comments"
                      onClick={() => setCommentsStory(story)}
                    />
                    <StoryAction
                      active={story.viewer.saved}
                      count={story.counts.saves}
                      icon={Bookmark}
                      label={
                        story.viewer.saved ? "Remove saved Story" : "Save Story"
                      }
                      onClick={() => toggleInteraction(story, "SAVE")}
                    />
                    <StoryAction
                      icon={copied ? Check : Share2}
                      label="Share Story"
                      onClick={() => shareStory(story)}
                    />
                    <div className="relative">
                      <StoryAction
                        icon={MoreHorizontal}
                        label="More Story actions"
                        onClick={() =>
                          setMenuStoryId((value) =>
                            value === story.id ? null : story.id,
                          )
                        }
                      />
                      {menuStoryId === story.id ? (
                        <div className="absolute bottom-0 right-14 w-56 rounded-2xl border border-white/15 bg-[#10241e]/95 p-1.5 text-left shadow-2xl backdrop-blur-xl">
                          <button
                            className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-xs font-bold hover:bg-white/10"
                            onClick={() => {
                              setWhyStory(story);
                              setMenuStoryId(null);
                            }}
                            type="button"
                          >
                            <CircleHelp className="h-4 w-4" />
                            Why this Story?
                          </button>
                          <button
                            className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-xs font-bold hover:bg-white/10"
                            onClick={() => hideStory(story)}
                            type="button"
                          >
                            <X className="h-4 w-4" />
                            Show me less like this
                          </button>
                          <button
                            className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-xs font-bold text-rose-200 hover:bg-white/10"
                            onClick={() => {
                              setMenuStoryId(null);
                              window.location.assign(
                                `/stories/report?story=${story.id}`,
                              );
                            }}
                            type="button"
                          >
                            <Flag className="h-4 w-4" />
                            Report Story
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <aside className="hidden h-full border-l border-white/10 bg-[#0a211a] px-7 py-24 lg:flex lg:flex-col">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-kondo-lime">
                  Useful next step
                </p>
                <h2 className="mt-3 text-2xl font-black tracking-tight">
                  Turn this Story into action.
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/60">
                  {story.recommendationReason}. Kondo favors practical relevance
                  over raw popularity.
                </p>
                <div className="mt-6 space-y-2">
                  {story.links.map((link) =>
                    link.href ? (
                      <Link
                        className="flex min-h-12 items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold transition hover:border-kondo-lime/50 hover:bg-white/10"
                        href={link.href}
                        key={link.id}
                      >
                        <span className="truncate">{link.label}</span>
                        <ChevronRight className="h-4 w-4 text-kondo-lime" />
                      </Link>
                    ) : (
                      <div
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                        key={link.id}
                      >
                        <p className="text-[10px] font-black uppercase tracking-wider text-white/45">
                          {link.type.toLowerCase()}
                        </p>
                        <p className="mt-1 text-sm font-bold">{link.label}</p>
                      </div>
                    ),
                  )}
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <Button
                    aria-label="Previous Story"
                    disabled={index === 0}
                    onClick={() => moveTo(index - 1)}
                    size="icon"
                    type="button"
                    variant="secondary"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-bold text-white/45">
                    {index + 1} / {stories.length}
                  </span>
                  <Button
                    aria-label="Next Story"
                    disabled={index === stories.length - 1}
                    onClick={() => moveTo(index + 1)}
                    size="icon"
                    type="button"
                    variant="secondary"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </aside>
            </section>
          );
        })}
      </div>

      <AnimatePresence>
        {playbackReady && !preference ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[80] grid place-items-end bg-black/65 p-3 backdrop-blur-sm sm:place-items-center"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
          >
            <motion.section
              aria-labelledby="story-playback-title"
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#10241e] p-6 text-white shadow-2xl"
              initial={{ opacity: 0, y: 16 }}
              role="dialog"
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-kondo-lime text-kondo-forest">
                <Play className="h-5 w-5" fill="currentColor" />
              </span>
              <h2
                className="mt-5 text-2xl font-black tracking-tight"
                id="story-playback-title"
              >
                Choose how Stories play
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/60">
                Autoplay keeps navigation fluid. Data saver waits for your tap
                and reduces mobile data use. You can change this anytime.
              </p>
              <div className="mt-6 grid gap-3">
                <Button
                  className="bg-kondo-lime text-kondo-forest hover:bg-white"
                  onClick={() => choosePreference("autoplay")}
                  type="button"
                >
                  <Play className="h-4 w-4" /> Continue with autoplay
                </Button>
                <Button
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  onClick={() => choosePreference("data-saver")}
                  type="button"
                  variant="secondary"
                >
                  <SignalLow className="h-4 w-4" /> Use data saver
                </Button>
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <StoryCommentsSheet
        onClose={() => setCommentsStory(null)}
        story={commentsStory}
      />

      <AnimatePresence>
        {whyStory ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={() => setWhyStory(null)}
          >
            <motion.section
              aria-labelledby="why-story-title"
              className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#10241e] p-6"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
              <div className="flex items-center justify-between">
                <CircleHelp className="h-6 w-6 text-kondo-lime" />
                <Button
                  aria-label="Close recommendation explanation"
                  onClick={() => setWhyStory(null)}
                  size="icon"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <h2 className="mt-4 text-xl font-black" id="why-story-title">
                Why this Story?
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/65">
                {whyStory.recommendationReason}. Kondo also balances freshness,
                editorial quality and creator diversity. Views alone never
                determine your feed.
              </p>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!online ? (
        <div className="fixed inset-x-4 bottom-4 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-amber-100 px-4 py-3 text-xs font-bold text-amber-900 shadow-xl">
          <SignalLow className="h-4 w-4" />
          You are offline. The current poster remains available; reconnect to
          continue.
        </div>
      ) : null}
    </main>
  );
}

function StoryAction({
  icon: Icon,
  label,
  count,
  active = false,
  onClick,
}: {
  icon: typeof Heart;
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={
        label.includes("Like") || label.includes("Save") ? active : undefined
      }
      className="group flex min-h-11 min-w-11 flex-col items-center justify-center rounded-2xl text-white outline-none focus-visible:ring-2 focus-visible:ring-kondo-lime"
      onClick={onClick}
      type="button"
    >
      <span
        className={cn(
          "grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/35 shadow-lg backdrop-blur-md transition group-hover:scale-105 group-hover:bg-black/55",
          active && "border-kondo-lime/50 bg-kondo-lime text-kondo-forest",
        )}
      >
        <Icon
          aria-hidden="true"
          className="h-[18px] w-[18px]"
          fill={active ? "currentColor" : "none"}
        />
      </span>
      {typeof count === "number" ? (
        <span className="mt-0.5 text-[10px] font-black tabular-nums">
          {count > 999 ? `${Math.round(count / 100) / 10}k` : count}
        </span>
      ) : null}
    </button>
  );
}
