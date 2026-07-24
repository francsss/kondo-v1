"use client";

import Link from "next/link";
import { Check, Heart, MessageCircle, Pin, Share2 } from "lucide-react";
import { useState } from "react";
import { BookmarkButton } from "@/components/features/bookmarks/BookmarkButton";
import { MessageUserButton } from "@/components/features/messages/MessageUserButton";
import { PostActions } from "@/components/features/community/PostActions";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MediaImage } from "@/components/ui/MediaImage";
import { formatRelativeDate } from "@/lib/presentation";
import { cn } from "@/lib/utils";

type FeedPostProps = {
  post: {
    id: string;
    title: string | null;
    content: string;
    pinnedAt: Date | null;
    createdAt: Date;
    author: {
      id: string;
      firstName: string;
      lastName: string;
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
    media?: Array<{
      media: { id: string; altText: string | null };
    }>;
    _count: { comments: number; reactions: number };
  };
};

export function FeedPost({
  post,
  currentUserId,
  canModerate = false,
  immersive = false,
}: FeedPostProps & {
  currentUserId: string;
  canModerate?: boolean;
  immersive?: boolean;
}) {
  const [liked, setLiked] = useState(post.reactions.length > 0);
  const [reactionCount, setReactionCount] = useState(post._count.reactions);
  const [copied, setCopied] = useState(false);

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
    <Card
      className={cn(
        "overflow-hidden p-0 transition duration-300 hover:-translate-y-0.5 hover:shadow-soft",
        immersive &&
          "rounded-[1.75rem] border-border/80 shadow-[0_8px_30px_rgba(16,24,40,0.045)] hover:border-primary/20",
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
            className={immersive ? "h-11 w-11" : undefined}
            firstName={post.author.firstName}
            lastName={post.author.lastName}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-bold text-kondo-ink dark:text-white">
                {post.author.firstName} {post.author.lastName}
              </span>
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
          <div
            className={`mt-4 grid gap-2 overflow-hidden rounded-2xl ${
              post.media.length > 1 ? "grid-cols-2" : "grid-cols-1"
            }`}
          >
            {post.media.map(({ media }) => (
              <MediaImage
                alt={media.altText ?? "Post image"}
                className={cn(
                  "aspect-[4/3] h-full w-full object-cover",
                  immersive && "max-h-[620px]",
                )}
                height={720}
                key={media.id}
                mediaId={media.id}
                sizes="(min-width: 1280px) 50vw, 90vw"
                width={960}
              />
            ))}
          </div>
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
            <Heart
              aria-hidden="true"
              className="h-4 w-4"
              fill={liked ? "currentColor" : "none"}
            />
            {immersive ? (
              <span className="hidden sm:inline">Helpful</span>
            ) : null}
            {reactionCount}
          </Button>
          <Button
            asChild
            className={immersive ? "px-3" : undefined}
            size="sm"
            variant="ghost"
          >
            <Link
              href={`/communities/${post.community.slug}?post=${post.id}#comments`}
            >
              <MessageCircle aria-hidden="true" className="h-4 w-4" />
              {immersive ? (
                <span className="hidden sm:inline">Comments</span>
              ) : null}
              {post._count.comments}
            </Link>
          </Button>
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
  );
}
