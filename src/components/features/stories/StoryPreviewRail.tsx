"use client";

import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { MediaImage } from "@/components/ui/MediaImage";
import type { StoryFeedItem } from "@/lib/stories";
import { cn } from "@/lib/utils";

export function StoryPreviewRail({
  stories,
  eyebrow = "Stories for you",
  title = "See student life, then take the next useful step.",
  compact = false,
  immersive = false,
  entryPoint,
}: {
  stories: StoryFeedItem[];
  eyebrow?: string;
  title?: string;
  compact?: boolean;
  immersive?: boolean;
  entryPoint: string;
}) {
  const router = useRouter();
  const railRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({
    backward: false,
    forward: stories.length > 1,
  });

  const updateScrollState = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const next = {
      backward: rail.scrollLeft > 8,
      forward: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 8,
    };
    setScrollState((current) =>
      current.backward === next.backward && current.forward === next.forward
        ? current
        : next,
    );
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(updateScrollState);
    window.addEventListener("resize", updateScrollState);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [stories.length, updateScrollState]);

  if (!stories.length) return null;

  function scrollRail(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    rail.scrollBy({
      behavior: reduceMotion ? "auto" : "smooth",
      left: direction * Math.max(220, rail.clientWidth * 0.72),
    });
  }

  function openStory(
    event: React.MouseEvent<HTMLAnchorElement>,
    story: StoryFeedItem,
  ) {
    event.preventDefault();
    const origin = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.sessionStorage.setItem(
      `kondo-scroll:${origin}`,
      String(window.scrollY),
    );
    router.push(
      `/stories?story=${encodeURIComponent(story.slug)}&from=${encodeURIComponent(
        origin,
      )}&entry=${encodeURIComponent(entryPoint)}`,
    );
  }

  return (
    <section
      aria-labelledby={`story-rail-${entryPoint}`}
      className={cn(
        "relative text-card-foreground",
        immersive
          ? "isolate -mx-4 overflow-visible py-2 sm:mx-0 sm:py-3"
          : "noise overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-gradient-to-br from-card via-card to-kondo-mint/50 shadow-[0_18px_55px_rgba(16,48,37,0.09)] dark:border-emerald-300/10 dark:to-emerald-400/10",
        !immersive && (compact ? "p-4 sm:p-5" : "p-5 sm:p-7"),
      )}
    >
      {immersive ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-4 inset-y-10 -z-10 bg-[radial-gradient(circle_at_18%_35%,rgba(32,165,119,0.13),transparent_36%),radial-gradient(circle_at_82%_58%,rgba(207,239,93,0.12),transparent_34%)] blur-2xl dark:opacity-70 sm:-inset-x-8"
        />
      ) : null}
      <div
        className={cn(
          "flex items-end justify-between gap-4",
          immersive && "px-4 sm:px-0",
        )}
      >
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.17em] text-kondo-green">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-[ping_700ms_cubic-bezier(0,0,0.2,1)_1] rounded-full bg-kondo-green opacity-40 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-kondo-green" />
            </span>
            {eyebrow}
          </p>
          <h2
            className={cn(
              "mt-1.5 max-w-2xl font-black tracking-[-0.03em] text-kondo-ink dark:text-white",
              immersive
                ? "text-xl sm:text-2xl"
                : compact
                  ? "text-lg"
                  : "text-xl sm:text-2xl",
            )}
            id={`story-rail-${entryPoint}`}
          >
            {title}
          </h2>
        </div>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <button
            aria-label="Previous Stories"
            className="inline-grid h-9 w-9 place-items-center rounded-full border border-kondo-green/15 bg-background/80 text-kondo-forest shadow-sm transition hover:-translate-y-0.5 hover:border-kondo-green/35 hover:bg-kondo-mint disabled:pointer-events-none disabled:opacity-35 dark:bg-white/5 dark:text-emerald-200 dark:hover:bg-white/10 motion-reduce:transform-none motion-reduce:transition-none"
            disabled={!scrollState.backward}
            onClick={() => scrollRail(-1)}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            aria-label="Next Stories"
            className="inline-grid h-9 w-9 place-items-center rounded-full border border-kondo-green/15 bg-background/80 text-kondo-forest shadow-sm transition hover:-translate-y-0.5 hover:border-kondo-green/35 hover:bg-kondo-mint disabled:pointer-events-none disabled:opacity-35 dark:bg-white/5 dark:text-emerald-200 dark:hover:bg-white/10 motion-reduce:transform-none motion-reduce:transition-none"
            disabled={!scrollState.forward}
            onClick={() => scrollRail(1)}
            type="button"
          >
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </button>
          <Link
            className="ml-1 inline-flex items-center gap-1.5 text-xs font-black text-kondo-green hover:underline"
            href="/stories"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
      <div
        className={cn(
          "scrollbar-none flex snap-x snap-mandatory overflow-x-auto touch-pan-x",
          immersive
            ? "mt-4 gap-3 scroll-px-4 px-4 pb-3 sm:mt-5 sm:gap-4 sm:scroll-px-0 sm:px-0"
            : "-mx-1 mt-4 gap-3 px-1 pb-2 sm:mt-5 sm:gap-4",
        )}
        onScroll={updateScrollState}
        ref={railRef}
      >
        {stories.map((story) => (
          <Link
            aria-label={`Watch ${story.title}`}
            className={cn(
              "group relative isolate shrink-0 snap-start overflow-hidden rounded-[1.5rem] bg-kondo-ink text-white outline-none ring-offset-card transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_35px_rgba(4,29,22,0.25)] focus-visible:ring-2 focus-visible:ring-kondo-green focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none",
              immersive
                ? "h-[19rem] w-[172px] shadow-[0_20px_48px_rgba(4,29,22,0.2)] sm:h-[21rem] sm:w-[208px]"
                : compact
                  ? "h-64 w-[172px] sm:h-[17rem] sm:w-[184px]"
                  : "h-72 w-[190px] sm:h-80 sm:w-[214px]",
            )}
            href={story.href}
            key={story.id}
            onClick={(event) => openStory(event, story)}
          >
            {story.posterMediaId ? (
              <MediaImage
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-95 transition duration-500 group-hover:scale-[1.035] motion-reduce:transform-none motion-reduce:transition-none"
                height={640}
                mediaId={story.posterMediaId}
                sizes="190px"
                width={360}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-kondo-forest via-[#1b6d55] to-kondo-navy" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-black/20" />
            <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
              <span className="relative">
                <Avatar
                  className="h-10 w-10 border-2 border-white/90 ring-0 shadow-lg"
                  firstName={story.creator.name.split(" ")[0] ?? "Kondo"}
                  lastName={
                    story.creator.name.split(" ").slice(1).join(" ") || "Member"
                  }
                  mediaId={story.creator.avatarMediaId}
                  seed={story.creator.id}
                />
                {story.creator.country?.emoji ? (
                  <span
                    aria-label={story.creator.country.name}
                    className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-white text-[11px] shadow"
                    role="img"
                  >
                    {story.creator.country.emoji}
                  </span>
                ) : null}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[10px] font-black backdrop-blur-md">
                <Play
                  aria-hidden="true"
                  className="h-3 w-3"
                  fill="currentColor"
                />
                {story.durationSeconds}s
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-kondo-lime">
                {story.category.icon} {story.category.name}
              </p>
              <h3 className="mt-1.5 line-clamp-2 text-[15px] font-black leading-5 tracking-[-0.02em]">
                {story.title}
              </h3>
              <p className="mt-2 truncate text-[11px] font-bold text-white/90">
                {story.creator.name}
              </p>
              {story.creator.university ? (
                <p className="mt-0.5 truncate text-[10px] font-semibold text-white/60">
                  {story.creator.university.shortName ??
                    story.creator.university.name}
                </p>
              ) : null}
            </div>
          </Link>
        ))}
        <Link
          className={cn(
            "grid shrink-0 snap-start place-items-center rounded-[1.4rem] border border-dashed border-kondo-green/35 bg-kondo-mint/50 p-4 text-center text-kondo-forest transition hover:bg-kondo-mint dark:bg-emerald-400/5 dark:text-emerald-300",
            immersive
              ? "h-[19rem] w-[160px] sm:h-[21rem] sm:w-[185px]"
              : compact
                ? "h-64 w-[150px] sm:h-[17rem]"
                : "h-72 w-[170px] sm:h-80 sm:w-[185px]",
          )}
          href="/stories"
        >
          <span>
            <ArrowRight className="mx-auto h-5 w-5" />
            <span className="mt-2 block text-xs font-black">
              Explore Student Stories
            </span>
          </span>
        </Link>
      </div>
    </section>
  );
}
