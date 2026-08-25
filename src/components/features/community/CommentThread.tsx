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
import { KONDO_CONTROL_CLASS } from "@/components/ui/Form";
import { useKeyboardAwareFocus } from "@/lib/use-keyboard-aware-focus";
import { MessageUserButton } from "@/components/features/messages/MessageUserButton";
import { OfficialMark } from "@/components/features/official-profile/OfficialMark";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { formatRelativeDate } from "@/lib/presentation";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { ExpandableText } from "@/components/ui/ClampedText";
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
    avatarMediaId?: string | null;
    officialProfileStatus?: string;
    officialOrganizationType?: string | null;
    officialOrganizationName?: string | null;
    officialVerifiedAt?: Date | string | null;
    country: { emoji: string | null } | null;
    university: { shortName: string | null } | null;
  };
  reactions: Array<{ id: string }>;
  _count: { reactions: number };
};

/**
 * Returns the parsed body on success and `null` on failure, so a caller can
 * both branch on the outcome and read the record the server created.
 */
type RequestFn = (
  url: string,
  method: string,
  body?: unknown,
) => Promise<{ comment?: { id?: string } } | null>;

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
  viewer,
  autoFocus = false,
}: {
  postId: string;
  currentUserId: string;
  canComment: boolean;
  canModerate: boolean;
  comments: CommentItem[];
  /**
   * Who is commenting, so a comment can be drawn the instant it is sent
   * rather than after the server has been asked for the thread again.
   */
  viewer: CommentItem["author"];
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  // Whatever the field you are typing in, keep it above the keyboard. Same
  // hook the focused forms use rather than a second implementation.
  useKeyboardAwareFocus();
  /*
   * Comments posted in this session, shown before the server has been asked
   * for the thread again.
   *
   * Posting used to mean a round trip to `router.refresh()` before anything
   * appeared: on a phone connection the comment box emptied and then nothing
   * happened for a second or more, which reads as a failure and gets the send
   * button pressed twice. The local copy is dropped as soon as the refreshed
   * thread contains it, so nothing is shown twice and nothing survives a
   * comment the server rejected.
   */
  const [pendingComments, setPendingComments] = useState<CommentItem[]>([]);
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [visibleConversations, setVisibleConversations] = useState(
    INITIAL_CONVERSATIONS,
  );

  /*
   * Derived, not synchronised. An effect that pruned the optimistic rows once
   * the server's copy arrived would be a `setState` inside an effect for
   * something render can simply work out: a pending row is one the server has
   * not sent back yet. The id is swapped for the real one as soon as the POST
   * answers, so this filter retires it the moment the refreshed thread lands.
   */
  const merged = useMemo(() => {
    if (!pendingComments.length) return comments;
    const known = new Set(comments.map((comment) => comment.id));
    return [
      ...comments,
      ...pendingComments.filter((comment) => !known.has(comment.id)),
    ];
  }, [comments, pendingComments]);

  const { childrenByParent, rootComments } = useMemo(() => {
    const commentIds = new Set(merged.map((comment) => comment.id));
    const roots: CommentItem[] = [];
    const children = new Map<string, CommentItem[]>();

    for (const comment of merged) {
      if (!comment.parentId || !commentIds.has(comment.parentId)) {
        roots.push(comment);
        continue;
      }
      const current = children.get(comment.parentId) ?? [];
      current.push(comment);
      children.set(comment.parentId, current);
    }

    return { childrenByParent: children, rootComments: roots };
  }, [merged]);

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
      return null;
    }
    router.refresh();
    return (payload ?? {}) as { comment?: { id?: string } };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = content.trim();
    if (!body) return;
    const optimisticId = `pending-${Date.now()}`;
    setPendingComments((current) => [
      ...current,
      {
        id: optimisticId,
        parentId: replyTo?.id ?? null,
        content: body,
        createdAt: new Date(),
        editedAt: null,
        author: viewer,
        reactions: [],
        _count: { reactions: 0 },
      },
    ]);
    // Cleared now, not after the round trip: the box you just sent from should
    // be empty and ready for the next thought.
    setContent("");
    const previousReply = replyTo;
    setReplyTo(null);
    const result = await request(`/api/posts/${postId}/comments`, "POST", {
      content: body,
      parentId: previousReply?.id,
    });
    const ok = Boolean(result);
    const createdId = result?.comment?.id;
    if (createdId) {
      // Adopt the server's id, so the refreshed thread replaces this row
      // rather than appearing beside it.
      setPendingComments((current) =>
        current.map((comment) =>
          comment.id === optimisticId ? { ...comment, id: createdId } : comment,
        ),
      );
    }
    if (!ok) {
      setPendingComments((current) =>
        current.filter((comment) => comment.id !== optimisticId),
      );
      setContent(body);
      setReplyTo(previousReply);
    }
    if (ok) {
      captureProductEvent(
        replyTo
          ? PRODUCT_EVENTS.COMMUNITY_REPLY_CREATED
          : PRODUCT_EVENTS.COMMUNITY_COMMENT_CREATED,
        {
          target_type: "post",
        },
      );
    }
  }

  function beginReply(comment: CommentItem) {
    setReplyTo({
      id: comment.id,
      authorName: `${comment.author.firstName} ${comment.author.lastName}`,
    });
    window.setTimeout(() => {
      const composer = composerRef.current;
      if (!composer) return;
      /*
       * Only scroll if the composer is genuinely off screen.
       *
       * `scrollIntoView({ block: "center" })` ran every time, so tapping Reply
       * on a comment right above an already-visible box yanked the whole thread
       * to re-centre it — the page moving for no reason anyone could see.
       * Measured against the visual viewport, because with a keyboard up the
       * layout viewport is not what the reader can see.
       */
      const viewport = window.visualViewport;
      const visibleTop = viewport?.offsetTop ?? 0;
      const visibleBottom = visibleTop + (viewport?.height ?? window.innerHeight);
      const box = composer.getBoundingClientRect();
      if (box.top < visibleTop || box.bottom > visibleBottom) {
        composer.scrollIntoView({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "nearest",
        });
      }
      composer.focus({ preventScroll: true });
    }, 30);
  }

  const shownRoots = rootComments.slice(0, visibleConversations);
  const remainingConversations = rootComments.length - shownRoots.length;

  return (
    <div>
      {canComment ? (
        <form
          /*
           * A field, not a panel. It was a bordered slab with an inner shadow
           * around a second bordered box — two frames around one textarea, and
           * on a dark theme the pair read as a grey block dropped into the
           * thread.
           */
          className="mt-5"
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
            /*
             * Kondo's own control. The focus ring is painted inside the box,
             * so nothing around the field moves when it gains focus — the
             * previous 3px outer glow grew the element's visual footprint and
             * nudged the action row under it on every tap.
             */
            className={`${KONDO_CONTROL_CLASS} min-h-24 resize-y py-3 text-sm leading-6`}
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
  request: RequestFn;
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
            /*
             * One step in, at any depth. Indenting per level turned a
             * three-deep thread into a staircase that left about half a phone's
             * width for the words; the rule down the left is what says "this is
             * a reply", and it says it just as well once.
             */
            depth === 0 && "ml-3 pl-3 sm:ml-6 sm:pl-4",
            depth > 0 && "ml-0 pl-3",
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
  request: RequestFn;
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
        className={cn(
          "h-9 w-9",
          depth > 0 && "h-8 w-8",
          comment.author.officialProfileStatus === "APPROVED" &&
            "ring-[3px] ring-kondo-lime",
        )}
        firstName={comment.author.firstName}
        lastName={comment.author.lastName}
        mediaId={comment.author.avatarMediaId}
        seed={comment.author.id}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="text-sm font-black text-kondo-ink dark:text-white">
            {comment.author.firstName} {comment.author.lastName}{" "}
            {comment.author.country?.emoji}
          </p>
          {comment.author.officialProfileStatus === "APPROVED" ? (
            <OfficialMark
              organizationName={comment.author.officialOrganizationName}
              organizationType={comment.author.officialOrganizationType}
              verifiedAt={comment.author.officialVerifiedAt}
            />
          ) : null}
          <span className="text-[11px] font-semibold text-muted-foreground">
            {comment.author.university?.shortName ?? "Kondo member"} ·{" "}
            {formatRelativeDate(comment.createdAt)}
            {comment.editedAt ? " · edited" : ""}
          </span>
        </div>
        <ExpandableText
          className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-foreground/80"
          lines={4}
          mobileLines={3}
          text={comment.content}
        />
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
