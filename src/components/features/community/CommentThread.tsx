"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  Flag,
  Heart,
  MessageCircleReply,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageUserButton } from "@/components/features/messages/MessageUserButton";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { formatRelativeDate } from "@/lib/presentation";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { cn } from "@/lib/utils";

export type CommentItem = {
  id: string;
  parentId: string | null;
  content: string;
  createdAt: Date;
  editedAt: Date | null;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    country: { emoji: string | null } | null;
    university: { shortName: string | null } | null;
  };
  reactions: Array<{ id: string }>;
  _count: { reactions: number };
};

type ReplyTarget = {
  id: string;
  authorName: string;
};

const INITIAL_CONVERSATIONS = 6;
const CONVERSATION_STEP = 6;

export function CommentThread({
  postId,
  currentUserId,
  canComment,
  canModerate,
  comments,
  autoFocus = false,
}: {
  postId: string;
  currentUserId: string;
  canComment: boolean;
  canModerate: boolean;
  comments: CommentItem[];
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [visibleConversations, setVisibleConversations] = useState(
    INITIAL_CONVERSATIONS,
  );

  const { childrenByParent, rootComments } = useMemo(() => {
    const commentIds = new Set(comments.map((comment) => comment.id));
    const roots: CommentItem[] = [];
    const children = new Map<string, CommentItem[]>();

    for (const comment of comments) {
      if (!comment.parentId || !commentIds.has(comment.parentId)) {
        roots.push(comment);
        continue;
      }
      const current = children.get(comment.parentId) ?? [];
      current.push(comment);
      children.set(comment.parentId, current);
    }

    return { childrenByParent: children, rootComments: roots };
  }, [comments]);

  useEffect(() => {
    if (!autoFocus || !canComment) return;
    const timer = window.setTimeout(
      () => composerRef.current?.focus({ preventScroll: true }),
      reducedMotion ? 0 : 260,
    );
    return () => window.clearTimeout(timer);
  }, [autoFocus, canComment, reducedMotion]);

  async function request(url: string, method: string, body?: unknown) {
    setPending(true);
    setError("");
    const response = await fetch(url, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setPending(false);
    if (!response?.ok) {
      setError(payload?.error ?? "Could not complete that action.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;
    const ok = await request(`/api/posts/${postId}/comments`, "POST", {
      content,
      parentId: replyTo?.id,
    });
    if (ok) {
      captureProductEvent(
        replyTo
          ? PRODUCT_EVENTS.COMMUNITY_REPLY_CREATED
          : PRODUCT_EVENTS.COMMUNITY_COMMENT_CREATED,
        {
          target_type: "post",
        },
      );
      setContent("");
      setReplyTo(null);
    }
  }

  function beginReply(comment: CommentItem) {
    setReplyTo({
      id: comment.id,
      authorName: `${comment.author.firstName} ${comment.author.lastName}`,
    });
    window.setTimeout(() => {
      composerRef.current?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "center",
      });
      composerRef.current?.focus({ preventScroll: true });
    }, 30);
  }

  const shownRoots = rootComments.slice(0, visibleConversations);
  const remainingConversations = rootComments.length - shownRoots.length;

  return (
    <div>
      {canComment ? (
        <form
          className="mt-5 rounded-[1.4rem] border border-border bg-muted/40 p-3 shadow-inner sm:p-4"
          onSubmit={submit}
        >
          <AnimatePresence initial={false}>
            {replyTo ? (
              <motion.div
                animate={{ height: "auto", opacity: 1, y: 0 }}
                className="mb-3 flex items-center justify-between overflow-hidden rounded-xl bg-kondo-mint/70 px-3 py-2 text-xs font-semibold text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300"
                exit={{ height: 0, marginBottom: 0, opacity: 0, y: -4 }}
                initial={{ height: 0, opacity: 0, y: -4 }}
                transition={{ duration: reducedMotion ? 0 : 0.18 }}
              >
                <span className="truncate">
                  Replying to{" "}
                  <strong className="font-black">{replyTo.authorName}</strong>
                </span>
                <button
                  className="ml-3 shrink-0 font-black underline-offset-2 hover:underline"
                  onClick={() => setReplyTo(null)}
                  type="button"
                >
                  Cancel
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <textarea
            aria-label="Write a comment"
            className="min-h-24 w-full resize-y rounded-2xl border border-border bg-card p-4 text-sm leading-6 shadow-sm outline-none transition duration-200 focus:border-kondo-green focus:shadow-[0_0_0_3px_rgba(7,122,79,0.10)]"
            maxLength={5000}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Add to the conversation…"
            ref={composerRef}
            required
            value={content}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            {error ? (
              <p
                aria-live="polite"
                className="text-xs font-semibold text-red-600"
                role="alert"
              >
                {error}
              </p>
            ) : (
              <p className="text-[11px] font-semibold text-muted-foreground">
                Keep it helpful and respectful.
              </p>
            )}
            <Button
              className="shadow-sm"
              disabled={pending || !content.trim()}
              size="sm"
              type="submit"
            >
              <Send aria-hidden="true" className="h-3.5 w-3.5" />
              {pending ? "Posting…" : replyTo ? "Reply" : "Comment"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-4 rounded-2xl bg-muted/45 px-4 py-3 text-sm text-muted-foreground">
          Join the community to comment.
        </p>
      )}

      {comments.length ? (
        <div aria-label="Comments" className="mt-5 space-y-3" role="feed">
          <AnimatePresence initial={false}>
            {shownRoots.map((comment, index) => (
              <CommentBranch
                canModerate={canModerate}
                childrenByParent={childrenByParent}
                comment={comment}
                currentUserId={currentUserId}
                depth={0}
                index={index}
                key={comment.id}
                onReply={beginReply}
                request={request}
              />
            ))}
          </AnimatePresence>
          {remainingConversations > 0 ? (
            <Button
              className="mt-2 w-full border-dashed"
              onClick={() =>
                setVisibleConversations((value) =>
                  Math.min(rootComments.length, value + CONVERSATION_STEP),
                )
              }
              size="sm"
              type="button"
              variant="secondary"
            >
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
              Load {Math.min(CONVERSATION_STEP, remainingConversations)} more
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-border px-4 py-7 text-center">
          <p className="text-sm font-bold text-foreground">
            Start the conversation
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Be the first to leave a thoughtful comment.
          </p>
        </div>
      )}
    </div>
  );
}

function CommentBranch({
  comment,
  currentUserId,
  canModerate,
  onReply,
  request,
  childrenByParent,
  depth,
  index,
}: {
  comment: CommentItem;
  currentUserId: string;
  canModerate: boolean;
  onReply: (comment: CommentItem) => void;
  request: (url: string, method: string, body?: unknown) => Promise<boolean>;
  childrenByParent: Map<string, CommentItem[]>;
  depth: number;
  index: number;
}) {
  const children = childrenByParent.get(comment.id) ?? [];

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      initial={{ opacity: 0, y: 8 }}
      layout
      transition={{ delay: Math.min(index * 0.025, 0.15), duration: 0.2 }}
    >
      <CommentRow
        canModerate={canModerate}
        comment={comment}
        currentUserId={currentUserId}
        depth={depth}
        onReply={() => onReply(comment)}
        request={request}
      />
      {children.length ? (
        <div
          className={cn(
            "relative mt-2 space-y-2",
            depth === 0 && "ml-5 pl-4 sm:ml-8 sm:pl-5",
            depth > 0 && "ml-3 pl-3",
          )}
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-px rounded-full bg-gradient-to-b from-primary/35 via-primary/20 to-transparent"
          />
          {children.map((child, childIndex) => (
            <CommentBranch
              canModerate={canModerate}
              childrenByParent={childrenByParent}
              comment={child}
              currentUserId={currentUserId}
              depth={depth + 1}
              index={childIndex}
              key={child.id}
              onReply={onReply}
              request={request}
            />
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}

function CommentRow({
  comment,
  currentUserId,
  canModerate,
  onReply,
  request,
  depth,
}: {
  comment: CommentItem;
  currentUserId: string;
  canModerate: boolean;
  onReply: () => void;
  request: (url: string, method: string, body?: unknown) => Promise<boolean>;
  depth: number;
}) {
  const reducedMotion = useReducedMotion();
  const [reacted, setReacted] = useState(comment.reactions.length > 0);
  const [reactionCount, setReactionCount] = useState(comment._count.reactions);
  const isAuthor = comment.author.id === currentUserId;

  async function react() {
    const next = !reacted;
    setReacted(next);
    setReactionCount((count) => count + (next ? 1 : -1));
    const ok = await request(
      `/api/comments/${comment.id}/reactions`,
      next ? "POST" : "DELETE",
      { type: "HELPFUL" },
    );
    if (!ok) {
      setReacted(!next);
      setReactionCount((count) => count + (next ? -1 : 1));
      return;
    }
    if (next) {
      captureProductEvent(PRODUCT_EVENTS.COMMUNITY_POST_REACTED, {
        target_type: "comment",
      });
    }
  }

  async function edit() {
    const content = window.prompt("Edit comment", comment.content);
    if (content === null || content.trim() === comment.content) return;
    await request(`/api/comments/${comment.id}`, "PATCH", { content });
  }

  async function remove() {
    if (!window.confirm("Remove this comment?")) return;
    await request(`/api/comments/${comment.id}`, "DELETE");
  }

  async function report() {
    const details = window.prompt("Why are you reporting this comment?");
    if (details === null) return;
    await request(`/api/comments/${comment.id}/report`, "POST", {
      reason: "OTHER",
      details,
    });
  }

  return (
    <article
      aria-label={`Comment by ${comment.author.firstName} ${comment.author.lastName}`}
      className={cn(
        "flex gap-3 rounded-[1.2rem] border border-transparent bg-muted/40 p-3.5 transition hover:border-border/70 hover:bg-muted/55 sm:p-4",
        depth > 0 && "rounded-2xl bg-secondary/30",
      )}
    >
      <Avatar
        className={cn("h-9 w-9", depth > 0 && "h-8 w-8")}
        firstName={comment.author.firstName}
        lastName={comment.author.lastName}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="text-sm font-black text-kondo-ink dark:text-white">
            {comment.author.firstName} {comment.author.lastName}{" "}
            {comment.author.country?.emoji}
          </p>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {comment.author.university?.shortName ?? "Kondo member"} ·{" "}
            {formatRelativeDate(comment.createdAt)}
            {comment.editedAt ? " · edited" : ""}
          </span>
        </div>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-foreground/80">
          {comment.content}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-0.5">
          <Button
            aria-label={reacted ? "Remove reaction" : "React to comment"}
            aria-pressed={reacted}
            className={cn(
              "h-8 gap-1.5 px-2.5 text-xs",
              reacted && "text-rose-600 dark:text-rose-400",
            )}
            onClick={react}
            size="sm"
            type="button"
            variant="ghost"
          >
            <motion.span
              animate={{
                scale: reacted && !reducedMotion ? [1, 1.35, 1] : 1,
              }}
              className="inline-flex"
              transition={{ duration: 0.28 }}
            >
              <Heart
                aria-hidden="true"
                className="h-3.5 w-3.5"
                fill={reacted ? "currentColor" : "none"}
              />
            </motion.span>
            {reactionCount}
          </Button>
          <Button
            className="h-8 px-2.5 text-xs"
            onClick={onReply}
            size="sm"
            type="button"
            variant="ghost"
          >
            <MessageCircleReply aria-hidden="true" className="h-3.5 w-3.5" />
            Reply
          </Button>
          <MessageUserButton
            compact
            currentUserId={currentUserId}
            userId={comment.author.id}
          />
          {isAuthor ? (
            <Button
              aria-label="Edit comment"
              className="h-8 w-8 px-0"
              onClick={edit}
              size="sm"
              title="Edit"
              type="button"
              variant="ghost"
            >
              <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {isAuthor || canModerate ? (
            <Button
              aria-label="Remove comment"
              className="h-8 w-8 px-0"
              onClick={remove}
              size="sm"
              title="Remove"
              type="button"
              variant="ghost"
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              aria-label="Report comment"
              className="h-8 w-8 px-0"
              onClick={report}
              size="sm"
              title="Report"
              type="button"
              variant="ghost"
            >
              <Flag aria-hidden="true" className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
