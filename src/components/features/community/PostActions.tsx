"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Flag, MoreHorizontal, Pin, PinOff, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
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
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    function closeMenu(event: PointerEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (
        event instanceof PointerEvent &&
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeMenu);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeMenu);
    };
  }, [open]);

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
    <div className="relative ml-auto" ref={containerRef}>
      <Button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Post actions"
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
        size="icon"
        type="button"
        variant="ghost"
      >
        <motion.span
          animate={{ rotate: open && !reducedMotion ? 90 : 0 }}
          className="inline-flex"
          transition={{ duration: 0.18 }}
        >
          <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
        </motion.span>
      </Button>
      <AnimatePresence>
        {open ? (
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            aria-orientation="vertical"
            className="absolute right-0 top-full z-20 mt-1 w-48 origin-top-right rounded-2xl border border-border bg-card p-1.5 text-card-foreground shadow-soft"
            exit={{
              opacity: 0,
              scale: reducedMotion ? 1 : 0.97,
              y: reducedMotion ? 0 : -4,
            }}
            id={menuId}
            initial={{
              opacity: 0,
              scale: reducedMotion ? 1 : 0.97,
              y: reducedMotion ? 0 : -4,
            }}
            role="menu"
            transition={{ duration: reducedMotion ? 0 : 0.16 }}
          >
            {isAuthor ? (
              <button
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition hover:bg-slate-100 dark:hover:bg-white/10"
                onClick={edit}
                role="menuitem"
                type="button"
              >
                Edit post
              </button>
            ) : null}
            {canModerate ? (
              <button
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition hover:bg-slate-100 dark:hover:bg-white/10"
                onClick={() =>
                  request(`/api/posts/${postId}/moderation`, "POST", {
                    action: pinned ? "UNPIN" : "PIN",
                  })
                }
                role="menuitem"
                type="button"
              >
                {pinned ? (
                  <PinOff aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <Pin aria-hidden="true" className="h-4 w-4" />
                )}
                {pinned ? "Unpin" : "Pin"}
              </button>
            ) : null}
            {isAuthor || canModerate ? (
              <button
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-400/10"
                onClick={remove}
                role="menuitem"
                type="button"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" /> Remove
              </button>
            ) : null}
            {!isAuthor ? (
              <button
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition hover:bg-slate-100 dark:hover:bg-white/10"
                onClick={report}
                role="menuitem"
                type="button"
              >
                <Flag aria-hidden="true" className="h-4 w-4" /> Report
              </button>
            ) : null}
            {error ? (
              <p className="px-3 py-2 text-xs text-red-600">{error}</p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
