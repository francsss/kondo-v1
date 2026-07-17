"use client";

import { Flag, Heart, MessageCircleReply, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageUserButton } from "@/components/features/messages/MessageUserButton";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { formatRelativeDate } from "@/lib/presentation";

type CommentItem = {
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

export function CommentThread({
  postId,
  currentUserId,
  canComment,
  canModerate,
  comments,
}: {
  postId: string;
  currentUserId: string;
  canComment: boolean;
  canModerate: boolean;
  comments: CommentItem[];
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

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
      parentId: replyTo ?? undefined,
    });
    if (ok) {
      setContent("");
      setReplyTo(null);
    }
  }

  return (
    <div>
      {canComment ? (
        <form className="mt-5" onSubmit={submit}>
          {replyTo ? (
            <div className="mb-2 flex items-center justify-between rounded-xl bg-kondo-mint/60 px-3 py-2 text-xs font-semibold text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300">
              Replying to a comment
              <button onClick={() => setReplyTo(null)} type="button">
                Cancel
              </button>
            </div>
          ) : null}
          <textarea
            className="min-h-24 w-full rounded-2xl border border-slate-200 bg-transparent p-4 text-sm outline-none focus:border-kondo-green dark:border-white/10"
            maxLength={5000}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Add to the conversation…"
            required
            value={content}
          />
          <div className="mt-2 flex items-center justify-between">
            {error ? <p className="text-xs text-red-600">{error}</p> : <span />}
            <Button disabled={pending} size="sm" type="submit">
              {pending ? "Posting…" : "Comment"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-4 text-sm text-slate-400">
          Join the community to comment.
        </p>
      )}

      {comments.length ? (
        <div className="mt-5 divide-y divide-slate-100 dark:divide-white/10">
          {comments.map((comment) => (
            <CommentRow
              canModerate={canModerate}
              comment={comment}
              currentUserId={currentUserId}
              key={comment.id}
              onReply={() => setReplyTo(comment.id)}
              request={request}
            />
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm text-slate-400">No comments yet.</p>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  currentUserId,
  canModerate,
  onReply,
  request,
}: {
  comment: CommentItem;
  currentUserId: string;
  canModerate: boolean;
  onReply: () => void;
  request: (url: string, method: string, body?: unknown) => Promise<boolean>;
}) {
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
      className={`flex gap-3 py-4 first:pt-0 last:pb-0 ${
        comment.parentId ? "ml-8 border-l-2 border-kondo-mint pl-4" : ""
      }`}
    >
      <Avatar
        firstName={comment.author.firstName}
        lastName={comment.author.lastName}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-black text-kondo-ink dark:text-white">
            {comment.author.firstName} {comment.author.lastName}{" "}
            {comment.author.country?.emoji}
          </p>
          <span className="text-xs text-slate-400">
            {comment.author.university?.shortName ?? "Kondo member"} ·{" "}
            {formatRelativeDate(comment.createdAt)}
            {comment.editedAt ? " · edited" : ""}
          </span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
          {comment.content}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <Button
            aria-pressed={reacted}
            onClick={react}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Heart
              className="h-3.5 w-3.5"
              fill={reacted ? "currentColor" : "none"}
            />
            {reactionCount}
          </Button>
          <Button onClick={onReply} size="sm" type="button" variant="ghost">
            <MessageCircleReply className="h-3.5 w-3.5" /> Reply
          </Button>
          <MessageUserButton
            compact
            currentUserId={currentUserId}
            userId={comment.author.id}
          />
          {isAuthor ? (
            <Button onClick={edit} size="sm" type="button" variant="ghost">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          ) : null}
          {isAuthor || canModerate ? (
            <Button onClick={remove} size="sm" type="button" variant="ghost">
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          ) : (
            <Button onClick={report} size="sm" type="button" variant="ghost">
              <Flag className="h-3.5 w-3.5" /> Report
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
