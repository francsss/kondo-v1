"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, MessageCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import {
  CommentThread,
  type CommentItem,
} from "@/components/features/community/CommentThread";
import {
  FeedPost,
  type FeedPostData,
} from "@/components/features/community/FeedPost";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  lockBodyScroll,
  makeBodySiblingsInert,
} from "@/lib/modal-accessibility";

export function CommunityPostFocus({
  post,
  comments,
  currentUserId,
  canComment,
  canModerate,
  closeHref,
}: {
  post: FeedPostData;
  comments: CommentItem[];
  currentUserId: string;
  canComment: boolean;
  canModerate: boolean;
  closeHref: string;
}) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMounted(true);
      setOpen(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    return lockBodyScroll();
  }, []);

  useEffect(() => {
    if (!open) return;
    const overlay = document.querySelector<HTMLElement>(
      "[data-community-post-focus]",
    );
    if (!overlay) return;
    return makeBodySiblingsInert(overlay);
  }, [open]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  function close() {
    if (closingRef.current) return;
    closingRef.current = true;
    setOpen(false);
  }

  function finishClose() {
    if (!closingRef.current) return;
    const originKey = `kondo:comment-origin:${post.id}`;
    const hasOrigin = Boolean(sessionStorage.getItem(originKey));
    sessionStorage.removeItem(originKey);
    if (hasOrigin) {
      router.back();
    } else {
      router.replace(closeHref, { scroll: false });
    }
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence onExitComplete={finishClose}>
      {open ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 backdrop-blur-lg sm:items-center sm:p-5"
          data-community-post-focus
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
        >
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            aria-label={`Conversation on ${post.title ?? "community post"}`}
            aria-modal="true"
            className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background shadow-2xl sm:h-[min(92dvh,980px)] sm:max-w-5xl sm:rounded-[2rem] sm:border sm:border-white/15"
            exit={{
              opacity: 0,
              scale: reducedMotion ? 1 : 0.975,
              y: reducedMotion ? 0 : 20,
            }}
            initial={{
              opacity: 0,
              scale: reducedMotion ? 1 : 0.975,
              y: reducedMotion ? 0 : 22,
            }}
            ref={panelRef}
            role="dialog"
            transition={{
              duration: reducedMotion ? 0 : 0.24,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <header className="relative z-20 flex shrink-0 items-center gap-3 border-b border-border bg-background/92 px-3 py-2.5 backdrop-blur-xl sm:px-5 sm:py-3">
              <Button
                aria-label="Back to previous page"
                onClick={close}
                size="icon"
                type="button"
                variant="ghost"
              >
                <ArrowLeft aria-hidden="true" className="h-5 w-5" />
              </Button>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-card text-lg shadow-sm">
                {post.community.icon ?? "✦"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black sm:text-base">
                  {post.community.name}
                </p>
                <p className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                  <MessageCircle aria-hidden="true" className="h-3 w-3" />
                  Post conversation
                </p>
              </div>
              <Button
                aria-label="Close conversation"
                className="ml-auto"
                onClick={close}
                size="icon"
                type="button"
                variant="secondary"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            </header>

            <main
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
              id="comments"
            >
              <div className="mx-auto w-full max-w-3xl space-y-4 px-3 py-4 pb-12 sm:px-6 sm:py-6">
                <FeedPost
                  canModerate={canModerate}
                  currentUserId={currentUserId}
                  focused
                  immersive
                  post={post}
                />
                <Card className="rounded-[1.75rem] border-primary/15 p-4 shadow-[0_18px_55px_rgba(16,24,40,0.08)] sm:p-6">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
                        Conversation
                      </p>
                      <h2 className="mt-1 text-xl font-black tracking-[-0.025em] text-kondo-ink dark:text-white sm:text-2xl">
                        {post._count.comments}{" "}
                        {post._count.comments === 1 ? "comment" : "comments"}
                      </h2>
                    </div>
                    {post._count.comments > comments.length ? (
                      <p className="text-right text-[11px] font-semibold text-muted-foreground">
                        Showing the first {comments.length}
                      </p>
                    ) : null}
                  </div>
                  <CommentThread
                    autoFocus
                    canComment={canComment}
                    canModerate={canModerate}
                    comments={comments}
                    currentUserId={currentUserId}
                    postId={post.id}
                  />
                </Card>
              </div>
            </main>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
