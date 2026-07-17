"use client";

import { Flag, MoreHorizontal, Pin, PinOff, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function PostActions({
  postId,
  content,
  isAuthor,
  canModerate,
  pinned,
}: {
  postId: string;
  content: string;
  isAuthor: boolean;
  canModerate: boolean;
  pinned: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
    setOpen(false);
    router.refresh();
    return true;
  }

  async function edit() {
    const next = window.prompt("Edit this post", content);
    if (next === null || next.trim() === content) return;
    await request(`/api/posts/${postId}`, "PATCH", { content: next });
  }

  async function remove() {
    if (!window.confirm("Remove this post?")) return;
    await request(`/api/posts/${postId}`, "DELETE");
  }

  async function report() {
    const details = window.prompt(
      "Briefly explain why you are reporting this post",
    );
    if (details === null) return;
    await request(`/api/posts/${postId}/report`, "POST", {
      reason: "OTHER",
      details,
    });
  }

  return (
    <div className="relative ml-auto">
      <Button
        aria-expanded={open}
        aria-label="Post actions"
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
        size="icon"
        type="button"
        variant="ghost"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-soft dark:border-white/10 dark:bg-[#17231f]">
          {isAuthor ? (
            <button
              className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/10"
              onClick={edit}
              type="button"
            >
              Edit post
            </button>
          ) : null}
          {canModerate ? (
            <button
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/10"
              onClick={() =>
                request(`/api/posts/${postId}/moderation`, "POST", {
                  action: pinned ? "UNPIN" : "PIN",
                })
              }
              type="button"
            >
              {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              {pinned ? "Unpin" : "Pin"}
            </button>
          ) : null}
          {isAuthor || canModerate ? (
            <button
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-400/10"
              onClick={remove}
              type="button"
            >
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          ) : null}
          {!isAuthor ? (
            <button
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/10"
              onClick={report}
              type="button"
            >
              <Flag className="h-4 w-4" /> Report
            </button>
          ) : null}
          {error ? <p className="px-3 py-2 text-xs text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
