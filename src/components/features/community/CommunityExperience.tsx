"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Check,
  ChevronDown,
  MessageCircle,
  MoreHorizontal,
  Settings,
  Share2,
  Users,
} from "lucide-react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { MediaImage } from "@/components/ui/MediaImage";
import { cn } from "@/lib/utils";

type CommunityIdentity = {
  name: string;
  slug: string;
  description: string;
  icon: string | null;
  coverMediaId: string | null;
  isVerified: boolean;
  isOfficial: boolean;
  status: string;
  joinPolicy: string;
  memberCount: number;
  postCount: number;
};

function CommunityUtilityActions({
  community,
  canModerate,
  compact = false,
}: {
  community: CommunityIdentity;
  canModerate: boolean;
  compact?: boolean;
}) {
  const actionsRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    function closeMenu(event: PointerEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        setMenuOpen(false);
        return;
      }
      if (
        event instanceof PointerEvent &&
        event.target instanceof Node &&
        !actionsRef.current?.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeMenu);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeMenu);
    };
  }, [menuOpen]);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: community.name,
          text: community.description,
          url,
        });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  }

  return (
    <div className="relative flex items-center gap-2" ref={actionsRef}>
      <Button
        aria-label={copied ? "Community link copied" : "Share community"}
        onClick={share}
        size={compact ? "icon" : "sm"}
        type="button"
        variant="secondary"
      >
        {copied ? (
          <Check aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Share2 aria-hidden="true" className="h-4 w-4" />
        )}
        {!compact ? (copied ? "Copied" : "Share") : null}
      </Button>
      <Button
        aria-expanded={menuOpen}
        aria-label="More community actions"
        onClick={() => setMenuOpen((open) => !open)}
        size={compact ? "icon" : "sm"}
        type="button"
        variant="secondary"
      >
        <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
        {!compact ? "More" : null}
      </Button>
      {menuOpen ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-2xl border border-border bg-card p-1.5 text-card-foreground shadow-soft">
          <Link
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-muted"
            href="/guidelines"
            onClick={() => setMenuOpen(false)}
          >
            <BookOpen aria-hidden="true" className="h-4 w-4" />
            Community guidelines
          </Link>
          {canModerate ? (
            <Link
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-muted"
              href={`/communities/${community.slug}/manage`}
              onClick={() => setMenuOpen(false)}
            >
              <Settings aria-hidden="true" className="h-4 w-4" />
              Manage community
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function CommunityExperience({
  community,
  canModerate,
  primaryActions,
  children,
}: {
  community: CommunityIdentity;
  canModerate: boolean;
  primaryActions: React.ReactNode;
  children: React.ReactNode;
}) {
  const coverRef = useRef<HTMLDivElement>(null);
  const compactStateRef = useRef(false);
  const [compactVisible, setCompactVisible] = useState(false);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: coverRef,
    offset: ["start start", "end start"],
  });
  const coverY = useTransform(scrollYProgress, [0, 1], [0, 56]);
  const coverScale = useTransform(scrollYProgress, [0, 1], [1, 1.035]);
  const coverOpacity = useTransform(
    scrollYProgress,
    [0, 0.85, 1],
    [1, 0.9, 0.72],
  );

  useEffect(() => {
    const cover = coverRef.current;
    if (!cover) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const nextVisible =
          entry.boundingClientRect.top < 0 && entry.intersectionRatio < 0.44;
        if (compactStateRef.current !== nextVisible) {
          compactStateRef.current = nextVisible;
          setCompactVisible(nextVisible);
        }
      },
      { threshold: [0, 0.44, 1] },
    );

    observer.observe(cover);
    return () => observer.disconnect();
  }, []);

  const statusLabel =
    community.status === "ACTIVE"
      ? community.joinPolicy.replaceAll("_", " ")
      : community.status.replaceAll("_", " ");

  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <motion.header
        animate={{
          opacity: compactVisible ? 1 : 0,
          y: reducedMotion || compactVisible ? 0 : -18,
        }}
        aria-hidden={!compactVisible}
        className={cn(
          "fixed inset-x-0 top-0 z-50 border-b border-border bg-background/90 px-3 py-2.5 shadow-sm backdrop-blur-xl sm:px-5",
          compactVisible ? "pointer-events-auto" : "pointer-events-none",
        )}
        initial={false}
        transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }}
      >
        <div className="mx-auto flex max-w-[1480px] items-center gap-2 sm:gap-3">
          <Button
            asChild
            aria-label="Back to all communities"
            size="icon"
            variant="ghost"
          >
            <Link href="/communities">
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </Link>
          </Button>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-card text-lg shadow-sm">
            {community.icon ?? "✦"}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-black sm:text-base">
                {community.name}
              </p>
              {community.isVerified ? (
                <BadgeCheck
                  aria-label="Verified community"
                  className="h-4 w-4 shrink-0 text-kondo-green"
                />
              ) : null}
            </div>
            <p className="hidden text-[11px] font-semibold text-muted-foreground sm:block">
              {community.memberCount.toLocaleString()} members
            </p>
          </div>
          <nav
            aria-label="Community quick navigation"
            className="ml-5 hidden items-center gap-1 lg:flex"
          >
            {[
              ["#feed", "Feed"],
              ["#about", "About"],
              ["#members", "Members"],
            ].map(([href, label]) => (
              <a
                className="rounded-full px-3 py-2 text-xs font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                href={href}
                key={href}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto">
            <CommunityUtilityActions
              canModerate={canModerate}
              community={community}
              compact
            />
          </div>
        </div>
      </motion.header>

      <header>
        <div
          className="relative h-[270px] overflow-hidden bg-kondo-navy sm:h-[340px] lg:h-[410px]"
          ref={coverRef}
        >
          <motion.div
            className="absolute -inset-x-3 -inset-y-2"
            style={
              reducedMotion
                ? undefined
                : {
                    opacity: coverOpacity,
                    scale: coverScale,
                    y: coverY,
                  }
            }
          >
            {community.coverMediaId ? (
              <MediaImage
                alt={`${community.name} cover`}
                className="h-full w-full object-cover"
                height={900}
                mediaId={community.coverMediaId}
                priority
                sizes="100vw"
                width={1800}
              />
            ) : (
              <div className="noise h-full w-full bg-gradient-to-br from-kondo-navy via-kondo-forest to-[#258266]">
                <div className="absolute -right-10 -top-24 h-80 w-80 rounded-full border-[58px] border-white/5 sm:right-16 sm:h-[430px] sm:w-[430px]" />
                <div className="absolute bottom-[-180px] left-[12%] h-96 w-96 rounded-full bg-kondo-lime/10 blur-3xl" />
              </div>
            )}
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/5 to-black/70" />
          <div className="absolute inset-x-0 top-0 z-10 px-3 py-3 sm:px-6 sm:py-5">
            <div className="mx-auto flex max-w-[1480px] items-center justify-between">
              <Button
                asChild
                className="border-white/20 bg-black/20 text-white shadow-none backdrop-blur-md hover:border-white/40 hover:bg-black/35"
                size="sm"
                variant="secondary"
              >
                <Link href="/communities">
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                  <span className="hidden sm:inline">All communities</span>
                  <span className="sm:hidden">Back</span>
                </Link>
              </Button>
              <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-white/80 backdrop-blur-md">
                Kondo community
              </span>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-6 text-white sm:px-7 sm:pb-8">
            <div className="mx-auto max-w-[1480px]">
              <p className="max-w-xl text-xs font-bold uppercase tracking-[0.2em] text-white/70 sm:text-sm">
                A space for students, shaped by students
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-20 border-b border-border bg-card">
          <div className="mx-auto max-w-[1480px] px-4 sm:px-7 lg:px-10">
            <div className="flex flex-col gap-5 pb-6 sm:pb-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <div className="-mt-12 grid h-24 w-24 place-items-center rounded-[1.8rem] border-[5px] border-card bg-white text-4xl shadow-lift sm:-mt-14 sm:h-28 sm:w-28 sm:rounded-[2rem] sm:text-5xl">
                  {community.icon ?? "✦"}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-5">
                  <h1 className="text-balance text-3xl font-black tracking-[-0.045em] text-kondo-ink dark:text-white sm:text-4xl lg:text-5xl">
                    {community.name}
                  </h1>
                  {community.isVerified ? (
                    <BadgeCheck
                      aria-label="Verified community"
                      className="h-6 w-6 text-kondo-green sm:h-7 sm:w-7"
                    />
                  ) : null}
                  {community.isOfficial ? (
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-secondary-foreground">
                      Official
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 max-w-3xl text-[15px] leading-7 text-muted-foreground sm:text-base">
                  {community.description}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-muted-foreground sm:text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <Users aria-hidden="true" className="h-4 w-4" />
                    {community.memberCount.toLocaleString()} members
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MessageCircle aria-hidden="true" className="h-4 w-4" />
                    {community.postCount.toLocaleString()}{" "}
                    {community.postCount === 1 ? "post" : "posts"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 uppercase tracking-wide">
                    <span className="h-1.5 w-1.5 rounded-full bg-kondo-green" />
                    {statusLabel}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {primaryActions}
                <CommunityUtilityActions
                  canModerate={canModerate}
                  community={community}
                />
              </div>
            </div>
          </div>
        </div>

        <nav
          aria-label="Community navigation"
          className="border-b border-border bg-background/95 backdrop-blur"
        >
          <div className="scrollbar-none mx-auto flex max-w-[1480px] items-center gap-1 overflow-x-auto px-3 sm:px-6 lg:px-9">
            <a
              aria-current="page"
              className="relative inline-flex h-14 shrink-0 items-center px-3 text-sm font-black text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
              href="#feed"
            >
              Feed
            </a>
            <a
              className="inline-flex h-14 shrink-0 items-center px-3 text-sm font-bold text-muted-foreground transition hover:text-foreground"
              href="#about"
            >
              About
            </a>
            <a
              className="inline-flex h-14 shrink-0 items-center px-3 text-sm font-bold text-muted-foreground transition hover:text-foreground"
              href="#members"
            >
              Members
            </a>
            <Link
              className="inline-flex h-14 shrink-0 items-center px-3 text-sm font-bold text-muted-foreground transition hover:text-foreground"
              href="/guidelines"
            >
              Guidelines
            </Link>
            <span className="ml-auto hidden items-center gap-1.5 text-xs font-semibold text-muted-foreground md:flex">
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
              Scroll to explore
            </span>
          </div>
        </nav>
      </header>

      {children}
    </div>
  );
}
