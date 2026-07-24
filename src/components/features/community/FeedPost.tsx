"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Heart,
  LoaderCircle,
  MessageCircle,
  Pin,
  Share2,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { BookmarkButton } from "@/components/features/bookmarks/BookmarkButton";
import { OfficialMark } from "@/components/features/official-profile/OfficialMark";
import { MessageUserButton } from "@/components/features/messages/MessageUserButton";
import { PostActions } from "@/components/features/community/PostActions";
import {
  PostMediaGallery,
  type PostMediaItem,
} from "@/components/features/community/PostMediaGallery";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatRelativeDate } from "@/lib/presentation";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { cn } from "@/lib/utils";

export type FeedPostData = {
  id: string;
  title: string | null;
  content: string;
  pinnedAt: Date | null;
  createdAt: Date;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    avatarMediaId?: string | null;
    officialProfileStatus?: string;
    officialOrganizationType?: string | null;
    officialOrganizationName?: string | null;
    officialVerifiedAt?: Date | string | null;
    country: { emoji: string | null } | null;
    university: { shortName: string | null; name: string } | null;
  };
  community: {
    name: string;
    slug: string;
    icon: string | null;
    isVerified: boolean;
  };
  reactions: Array<{ id: string }>;
  media?: PostMediaItem[];
  _count: { comments: number; reactions: number };
};

export function FeedPost({
  post,
  currentUserId,
  canModerate = false,
  immersive = false,
  focused = false,
}: {
  post: FeedPostData;
  currentUserId: string;
  canModerate?: boolean;
  immersive?: boolean;
  focused?: boolean;
}) {
  const [liked, setLiked] = useState(post.reactions.length > 0);
  const [reactionCount, setReactionCount] = useState(post._count.reactions);
  const [copied, setCopied] = useState(false);
  const [commentsOpening, setCommentsOpening] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!focused) return;
    const frame = window.requestAnimationFrame(() => setCommentsOpening(false));
    return () => window.cancelAnimationFrame(frame);
  }, [focused]);

  async function toggleReaction() {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setReactionCount((value) => value + (nextLiked ? 1 : -1));

    const response = await fetch(`/api/posts/${post.id}/reactions`, {
      method: nextLiked ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "HELPFUL" }),
    }).catch(() => null);

    if (!response?.ok) {
      setLiked(!nextLiked);
      setReactionCount((value) => value + (nextLiked ? -1 : 1));
      return;
    }
    if (nextLiked) {
      captureProductEvent(PRODUCT_EVENTS.COMMUNITY_POST_REACTED, {
        community_slug: post.community.slug,
        target_type: "post",
      });
    }
  }

  async function sharePost() {
    const url = new URL(
      `/communities/${post.community.slug}?post=${post.id}#comments`,
      window.location.origin,
    ).toString();
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title ?? `Post in ${post.community.name}`,
          text: post.content.slice(0, 180),
          url,
        });
        captureProductEvent(PRODUCT_EVENTS.COMMUNITY_POST_SHARED, {
          community_slug: post.community.slug,
          method: "native_share",
        });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(url);
    captureProductEvent(PRODUCT_EVENTS.COMMUNITY_POST_SHARED, {
      community_slug: post.community.slug,
      method: "copy_link",
    });
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  }

  return (
    <>
      <Card
        className={cn(
          "overflow-hidden p-0 transition duration-300 hover:-translate-y-0.5 hover:shadow-soft",
          immersive &&
            "rounded-[1.75rem] border-border/80 shadow-[0_8px_30px_rgba(16,24,40,0.045)] hover:border-primary/20",
          focused &&
            "hover:translate-y-0 hover:border-border/80 hover:shadow-[0_8px_30px_rgba(16,24,40,0.045)]",
        )}
      >
        {post.pinnedAt ? (
          <div
            className={cn(
              "flex items-center gap-1.5 border-b border-emerald-100 bg-kondo-mint/70 px-5 py-2 text-[11px] font-black uppercase tracking-wider text-kondo-forest dark:border-emerald-400/10 dark:bg-emerald-400/10 dark:text-emerald-300",
              immersive && "px-5 py-2.5 sm:px-7",
            )}
          >
            <Pin aria-hidden="true" className="h-3 w-3" />
            Pinned by community staff
          </div>
        ) : null}
        <article className={cn("p-5 sm:p-6", immersive && "sm:p-7")}>
          <div className="flex items-start gap-3">
            <Avatar
              className={cn(
                immersive ? "h-11 w-11" : undefined,
                post.author.officialProfileStatus === "APPROVED" &&
                  "ring-[3px] ring-kondo-lime",
              )}
              firstName={post.author.firstName}
              lastName={post.author.lastName}
              mediaId={post.author.avatarMediaId}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-bold text-kondo-ink dark:text-white">
                  {post.author.firstName} {post.author.lastName}
                </span>
                {post.author.officialProfileStatus === "APPROVED" ? (
                  <OfficialMark
                    organizationName={post.author.officialOrganizationName}
                    organizationType={post.author.officialOrganizationType}
                    verifiedAt={post.author.officialVerifiedAt}
                  />
                ) : null}
                <span aria-label="Country" className="text-sm">
                  {post.author.country?.emoji}
                </span>
                <span className="text-xs text-muted-foreground">
                  · {formatRelativeDate(post.createdAt)}
                </span>
              </div>
              {immersive ? (
                <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
                  {post.author.university?.shortName ??
                    post.author.university?.name ??
                    "Kondo member"}
                </p>
              ) : (
                <div className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-kondo-green">
                  <Link
                    className="hover:underline"
                    href={`/communities/${post.community.slug}`}
                  >
                    {post.community.icon} {post.community.name}
                  </Link>
                </div>
              )}
            </div>
            <PostActions
              canModerate={canModerate}
              content={post.content}
              isAuthor={post.author.id === currentUserId}
              pinned={Boolean(post.pinnedAt)}
              postId={post.id}
            />
          </div>

          {post.title ? (
            <h2
              className={cn(
                "mt-5 text-xl font-black tracking-[-0.025em] text-kondo-ink dark:text-white",
                immersive && "text-[1.35rem] leading-tight sm:text-2xl",
              )}
            >
              {post.title}
            </h2>
          ) : null}
          <p
            className={cn(
              "mt-2 whitespace-pre-line text-[15px] leading-7 text-muted-foreground",
              immersive && "mt-3 leading-7 text-foreground/80 sm:text-base",
            )}
          >
            {post.content}
          </p>
          {post.media?.length ? (
            <PostMediaGallery immersive={immersive} media={post.media} />
          ) : null}

          <div
            className={cn(
              "mt-5 flex items-center gap-1 border-t border-slate-100 pt-3 dark:border-white/10",
              immersive && "mt-6 gap-0.5 border-border",
            )}
          >
            <Button
              aria-pressed={liked}
              className={cn(
                liked && "text-rose-600 dark:text-rose-400",
                immersive && "px-3",
              )}
              onClick={toggleReaction}
              size="sm"
              type="button"
              variant="ghost"
            >
              <motion.span
                animate={{ scale: liked && !reducedMotion ? [1, 1.32, 1] : 1 }}
                className="inline-flex"
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <Heart
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill={liked ? "currentColor" : "none"}
                />
              </motion.span>
              {immersive ? (
                <span className="hidden sm:inline">Helpful</span>
              ) : null}
              {reactionCount}
            </Button>
            {focused ? (
              <Button
                aria-label="Comments are open"
                className={cn("text-foreground", immersive && "px-3")}
                size="sm"
                type="button"
                variant="soft"
              >
                <MessageCircle aria-hidden="true" className="h-4 w-4" />
                {immersive ? (
                  <span className="hidden sm:inline">Comments</span>
                ) : null}
                {post._count.comments}
              </Button>
            ) : (
              <Button
                asChild
                className={immersive ? "px-3" : undefined}
                size="sm"
                variant="ghost"
              >
                <Link
                  href={`/communities/${post.community.slug}?post=${post.id}`}
                  onClick={(event) => {
                    if (
                      event.button !== 0 ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    ) {
                      return;
                    }
                    sessionStorage.setItem(
                      `kondo:comment-origin:${post.id}`,
                      window.location.href,
                    );
                    setCommentsOpening(true);
                    window.setTimeout(() => setCommentsOpening(false), 8_000);
                  }}
                  scroll={false}
                >
                  {commentsOpening ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin"
                    />
                  ) : (
                    <MessageCircle aria-hidden="true" className="h-4 w-4" />
                  )}
                  {immersive ? (
                    <span className="hidden sm:inline">Comments</span>
                  ) : null}
                  {post._count.comments}
                </Link>
              </Button>
            )}
            <MessageUserButton
              compact
              currentUserId={currentUserId}
              userId={post.author.id}
            />
            <Button
              aria-label={copied ? "Post link copied" : "Share post"}
              onClick={sharePost}
              size="icon"
              title={copied ? "Link copied" : "Share post"}
              type="button"
              variant="ghost"
            >
              {copied ? (
                <Check aria-hidden="true" className="h-4 w-4" />
              ) : (
                <Share2 aria-hidden="true" className="h-4 w-4" />
              )}
            </Button>
            <BookmarkButton
              className="ml-auto"
              iconOnly
              targetId={post.id}
              targetType="POST"
            />
          </div>
        </article>
      </Card>

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {commentsOpening ? (
                <motion.div
                  animate={{ opacity: 1 }}
                  aria-busy="true"
                  aria-label="Opening post conversation"
                  className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/60 p-3 backdrop-blur-md sm:p-6"
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  role="status"
                  transition={{ duration: reducedMotion ? 0 : 0.18 }}
                >
                  <motion.div
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/15 bg-background p-4 shadow-2xl sm:p-6"
                    initial={{
                      opacity: 0,
                      scale: reducedMotion ? 1 : 0.97,
                      y: reducedMotion ? 0 : 12,
                    }}
                    transition={{
                      duration: reducedMotion ? 0 : 0.22,
                      ease: "easeOut",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 animate-pulse rounded-full bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-36 animate-pulse rounded-full bg-muted" />
                        <div className="h-2.5 w-24 animate-pulse rounded-full bg-muted" />
                      </div>
                    </div>
                    <div className="mt-6 space-y-3">
                      <div className="h-4 w-3/5 animate-pulse rounded-full bg-muted" />
                      <div className="h-3 w-full animate-pulse rounded-full bg-muted" />
                      <div className="h-3 w-4/5 animate-pulse rounded-full bg-muted" />
                    </div>
                    <div className="mt-7 border-t border-border pt-5">
                      <div className="h-24 animate-pulse rounded-2xl bg-muted" />
                    </div>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}
