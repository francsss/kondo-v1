"use client";

import Link from "next/link";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { MediaImage } from "@/components/ui/MediaImage";
import type { StoryFeedItem } from "@/lib/stories";
import { cn } from "@/lib/utils";

export function StoryPreviewRail({
  stories,
  eyebrow = "Stories for you",
  title = "See student life, then take the next useful step.",
  compact = false,
  entryPoint,
}: {
  stories: StoryFeedItem[];
  eyebrow?: string;
  title?: string;
  compact?: boolean;
  entryPoint: string;
}) {
  const router = useRouter();
  if (!stories.length) return null;

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
        "overflow-hidden rounded-[2rem] border border-border bg-card text-card-foreground shadow-[0_8px_30px_rgba(16,24,40,0.04)]",
        compact ? "p-4" : "p-5 sm:p-6",
      )}
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.17em] text-kondo-green">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
            {eyebrow}
          </p>
          <h2
            className={cn(
              "mt-1.5 max-w-2xl font-black tracking-[-0.03em] text-kondo-ink dark:text-white",
              compact ? "text-lg" : "text-xl sm:text-2xl",
            )}
            id={`story-rail-${entryPoint}`}
          >
            {title}
          </h2>
        </div>
        <Link
          className="hidden shrink-0 items-center gap-1.5 text-xs font-black text-kondo-green hover:underline sm:inline-flex"
          href="/stories"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="scrollbar-none -mx-1 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
        {stories.map((story) => (
          <Link
            aria-label={`Watch ${story.title}`}
            className={cn(
              "group relative shrink-0 snap-start overflow-hidden rounded-[1.4rem] bg-kondo-ink text-white outline-none ring-offset-card transition duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-kondo-green focus-visible:ring-offset-2",
              compact
                ? "h-48 w-[150px]"
                : "h-56 w-[170px] sm:h-64 sm:w-[190px]",
            )}
            href={story.href}
            key={story.id}
            onClick={(event) => openStory(event, story)}
          >
            {story.posterMediaId ? (
              <MediaImage
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-90 transition duration-300 group-hover:scale-[1.03]"
                height={640}
                mediaId={story.posterMediaId}
                sizes="190px"
                width={360}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-kondo-forest via-[#1b6d55] to-kondo-navy" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/5" />
            <span className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/25 backdrop-blur-md">
              <Play
                aria-hidden="true"
                className="ml-0.5 h-4 w-4"
                fill="currentColor"
              />
            </span>
            <div className="absolute inset-x-0 bottom-0 p-3.5">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-kondo-lime">
                {story.category.icon} {story.category.name}
              </p>
              <h3 className="mt-1.5 line-clamp-2 text-sm font-black leading-5">
                {story.title}
              </h3>
              <p className="mt-1 truncate text-[10px] font-semibold text-white/60">
                {story.creator.name} · {story.durationSeconds}s
              </p>
            </div>
          </Link>
        ))}
        <Link
          className={cn(
            "grid shrink-0 snap-start place-items-center rounded-[1.4rem] border border-dashed border-kondo-green/35 bg-kondo-mint/50 p-4 text-center text-kondo-forest transition hover:bg-kondo-mint dark:bg-emerald-400/5 dark:text-emerald-300",
            compact ? "h-48 w-[135px]" : "h-56 w-[150px] sm:h-64 sm:w-[165px]",
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
