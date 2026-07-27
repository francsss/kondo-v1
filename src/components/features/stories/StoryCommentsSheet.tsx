"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  LoaderCircle,
  MessageCircleReply,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { OfficialMark } from "@/components/features/official-profile/OfficialMark";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import type { StoryFeedItem } from "@/lib/stories";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

type StoryComment = {
  id: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    name: string;
    username: string | null;
    avatarMediaId: string | null;
    official: boolean;
    officialProfileStatus: string;
    officialOrganizationType: string | null;
    officialOrganizationName: string | null;
    officialVerifiedAt: string | null;
  };
  viewer: { canDelete: boolean };
};

export function StoryCommentsSheet({
  story,
  onClose,
}: {
  story: StoryFeedItem | null;
  onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [comments, setComments] = useState<StoryComment[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [content, setContent] = useState("");
  const [reply, setReply] = useState<StoryComment | null>(null);

  async function load(storyId: string) {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/stories/${storyId}/comments`, {
      credentials: "include",
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setLoading(false);
    if (!response?.ok) {
      setError(payload?.error ?? "Comments could not be loaded.");
      return;
    }
    setComments(payload.comments ?? []);
    setEnabled(payload.enabled !== false);
  }

  useEffect(() => {
    if (!story) return;
    const resetTimer = window.setTimeout(() => {
      setComments([]);
      setContent("");
      setReply(null);
      void load(story.id);
    }, 0);
    const focusTimer = window.setTimeout(
      () => inputRef.current?.focus({ preventScroll: true }),
      reducedMotion ? 0 : 240,
    );
    return () => {
      window.clearTimeout(resetTimer);
      window.clearTimeout(focusTimer);
    };
  }, [reducedMotion, story]);

  useEffect(() => {
    if (!story) return;
    function close(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose, story]);

  const { roots, children } = useMemo(() => {
    const rootComments: StoryComment[] = [];
    const replies = new Map<string, StoryComment[]>();
    const ids = new Set(comments.map((comment) => comment.id));
    for (const comment of comments) {
      if (!comment.parentId || !ids.has(comment.parentId)) {
        rootComments.push(comment);
      } else {
        const list = replies.get(comment.parentId) ?? [];
        list.push(comment);
        replies.set(comment.parentId, list);
      }
    }
    return { roots: rootComments, children: replies };
  }, [comments]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!story || !content.trim() || pending) return;
    setPending(true);
    setError("");
    const response = await fetch(`/api/stories/${story.id}/comments`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        parentId: reply?.id,
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setPending(false);
    if (!response?.ok) {
      setError(payload?.error ?? "Your comment could not be posted.");
      return;
    }
    captureProductEvent(PRODUCT_EVENTS.STORY_COMMENTED, {
      story_id: story.id,
      is_reply: Boolean(reply),
    });
    setContent("");
    setReply(null);
    await load(story.id);
  }

  async function remove(commentId: string) {
    if (!story) return;
    const response = await fetch(
      `/api/stories/${story.id}/comments/${commentId}`,
      { method: "DELETE", credentials: "include" },
    ).catch(() => null);
    if (!response?.ok) {
      setError("Comment could not be removed.");
      return;
    }
    setComments((items) => items.filter((item) => item.id !== commentId));
  }

  return (
    <AnimatePresence>
      {story ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[85] flex items-end justify-end bg-black/45 backdrop-blur-sm lg:p-4"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.section
            aria-labelledby="story-comments-title"
            aria-modal="true"
            animate={{ x: 0, y: 0 }}
            className="flex h-[min(84dvh,780px)] w-full flex-col rounded-t-[2rem] border border-border bg-card text-card-foreground shadow-2xl lg:h-[calc(100dvh-2rem)] lg:max-w-[480px] lg:rounded-[2rem]"
            exit={{
              x: reducedMotion ? 0 : 24,
              y: reducedMotion ? 0 : 24,
            }}
            initial={{
              x: reducedMotion ? 0 : 24,
              y: reducedMotion ? 0 : 24,
            }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            transition={{ duration: reducedMotion ? 0 : 0.22 }}
          >
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-kondo-green">
                  Helpful conversation
                </p>
                <h2 className="mt-1 font-black" id="story-comments-title">
                  Comments · {comments.length}
                </h2>
              </div>
              <Button
                aria-label="Close comments"
                onClick={onClose}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="h-5 w-5" />
              </Button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {loading ? (
                <div className="grid h-40 place-items-center">
                  <LoaderCircle
                    aria-label="Loading comments"
                    className="h-6 w-6 animate-spin text-kondo-green"
                  />
                </div>
              ) : roots.length ? (
                <div className="space-y-5">
                  {roots.map((comment) => (
                    <div key={comment.id}>
                      <CommentRow
                        comment={comment}
                        onRemove={remove}
                        onReply={(item) => {
                          setReply(item);
                          inputRef.current?.focus();
                        }}
                      />
                      {children.get(comment.id)?.length ? (
                        <div className="ml-10 mt-3 space-y-3 border-l border-border pl-3">
                          {children.get(comment.id)?.map((item) => (
                            <CommentRow
                              compact
                              comment={item}
                              key={item.id}
                              onRemove={remove}
                              onReply={() => {
                                setReply(comment);
                                inputRef.current?.focus();
                              }}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid h-44 place-items-center text-center">
                  <div>
                    <p className="text-3xl">💬</p>
                    <p className="mt-3 font-black">Start a useful exchange</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ask a clear question or add practical context.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <form
              className="border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
              onSubmit={submit}
            >
              {reply ? (
                <div className="mb-2 flex items-center justify-between rounded-xl bg-kondo-mint/70 px-3 py-2 text-xs font-semibold text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300">
                  <span className="truncate">
                    Replying to {reply.author.name}
                  </span>
                  <button
                    className="font-black"
                    onClick={() => setReply(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
              {enabled ? (
                <div className="flex items-end gap-2">
                  <textarea
                    aria-label="Write a Story comment"
                    className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm outline-none focus:border-kondo-green"
                    maxLength={1200}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="Add something helpful…"
                    ref={inputRef}
                    rows={1}
                    value={content}
                  />
                  <Button
                    aria-label={reply ? "Post reply" : "Post comment"}
                    disabled={pending || !content.trim()}
                    size="icon"
                    type="submit"
                  >
                    {pending ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ) : (
                <p className="rounded-2xl bg-muted p-3 text-center text-xs font-semibold text-muted-foreground">
                  Comments are disabled for this Story.
                </p>
              )}
              {error ? (
                <p
                  aria-live="polite"
                  className="mt-2 text-xs font-semibold text-red-600"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
            </form>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function CommentRow({
  comment,
  compact = false,
  onReply,
  onRemove,
}: {
  comment: StoryComment;
  compact?: boolean;
  onReply: (comment: StoryComment) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <article className="flex items-start gap-3">
      <Avatar
        className={compact ? "h-7 w-7" : "h-9 w-9"}
        firstName={comment.author.firstName}
        lastName={comment.author.lastName}
        mediaId={comment.author.avatarMediaId}
        seed={comment.author.id}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-black text-kondo-ink dark:text-white">
            {comment.author.name}
          </span>
          {comment.author.official ? (
            <OfficialMark
              organizationName={comment.author.officialOrganizationName}
              organizationType={comment.author.officialOrganizationType}
              verifiedAt={comment.author.officialVerifiedAt}
            />
          ) : null}
          <time className="text-[10px] text-muted-foreground">
            {new Intl.DateTimeFormat("en", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(comment.createdAt))}
          </time>
        </div>
        <p className="mt-1 whitespace-pre-line text-sm leading-5 text-foreground/80">
          {comment.content}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <button
            className="inline-flex min-h-7 items-center gap-1 text-[10px] font-black text-muted-foreground hover:text-kondo-green"
            onClick={() => onReply(comment)}
            type="button"
          >
            <MessageCircleReply className="h-3.5 w-3.5" /> Reply
          </button>
          {comment.viewer.canDelete ? (
            <button
              aria-label="Delete comment"
              className="inline-flex min-h-7 items-center gap-1 text-[10px] font-black text-muted-foreground hover:text-red-600"
              onClick={() => onRemove(comment.id)}
              type="button"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
