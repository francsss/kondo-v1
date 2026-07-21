"use client";

import Link from "next/link";
import { Heart, MessageCircle, Pin, Share2 } from "lucide-react";
import { useState } from "react";
import { BookmarkButton } from "@/components/features/bookmarks/BookmarkButton";
import { MessageUserButton } from "@/components/features/messages/MessageUserButton";
import { PostActions } from "@/components/features/community/PostActions";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MediaImage } from "@/components/ui/MediaImage";
import { formatRelativeDate } from "@/lib/presentation";

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
}: FeedPostProps & { currentUserId: string; canModerate?: boolean }) {
  const [liked, setLiked] = useState(post.reactions.length > 0);
  const [reactionCount, setReactionCount] = useState(post._count.reactions);

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

  return (
    <Card className="overflow-hidden p-0 transition duration-300 hover:-translate-y-0.5 hover:shadow-soft">
      {post.pinnedAt ? (
        <div className="flex items-center gap-1.5 border-b border-emerald-100 bg-kondo-mint/70 px-5 py-2 text-[11px] font-black uppercase tracking-wider text-kondo-forest dark:border-emerald-400/10 dark:bg-emerald-400/10 dark:text-emerald-300">
          <Pin aria-hidden="true" className="h-3 w-3" /> Pinned by moderators
        </div>
      ) : null}
      <article className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Avatar
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
            <div className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-kondo-green">
              <Link
                className="hover:underline"
                href={`/communities/${post.community.slug}`}
              >
                {post.community.icon} {post.community.name}
              </Link>
            </div>
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
          <h2 className="mt-5 text-xl font-black tracking-[-0.025em] text-kondo-ink dark:text-white">
            {post.title}
          </h2>
        ) : null}
        <p className="mt-2 whitespace-pre-line text-[15px] leading-7 text-muted-foreground">
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
                className="aspect-[4/3] h-full w-full object-cover"
                height={720}
                key={media.id}
                mediaId={media.id}
                sizes="(min-width: 1280px) 50vw, 90vw"
                width={960}
              />
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex items-center gap-1 border-t border-slate-100 pt-3 dark:border-white/10">
          <Button
            aria-pressed={liked}
            className={liked ? "text-rose-600 dark:text-rose-400" : undefined}
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
            {reactionCount}
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/communities/${post.community.slug}?post=${post.id}`}>
              <MessageCircle aria-hidden="true" className="h-4 w-4" />
              {post._count.comments}
            </Link>
          </Button>
          <MessageUserButton
            compact
            currentUserId={currentUserId}
            userId={post.author.id}
          />
          <Button
            aria-label="Share post"
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            size="icon"
            title="Copy page link"
            type="button"
            variant="ghost"
          >
            <Share2 aria-hidden="true" className="h-4 w-4" />
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
