"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The environment a creation or edit flow gets to itself.
 *
 * Filling in a form on a phone meant competing with the app: the workspace
 * navigation bar sat across the bottom over the action button, the global
 * header took a slice off the top, and the form was the smallest thing on its
 * own screen. So while one of these flows is open the chrome stands down —
 * `kondo-focus-form` hides anything marked `data-form-hide`, which is the same
 * mechanism Focus Mode already uses in the reader rather than a second one.
 *
 * Context is not lost with it. The header still names the organization and the
 * task, and Back is always there, so the student knows where they are and how
 * to leave — the navigation is quiet, not amputated.
 *
 * The action bar is sticky and sits above the safe area, so the phone keyboard
 * cannot bury Continue or Publish. The content column stops at a readable
 * width on desktop instead of stretching a form across a monitor.
 */

const FOCUS_CLASS = "kondo-focus-form";

export function FocusedFormShell({
  backHref,
  context,
  title,
  step,
  actions,
  children,
}: {
  backHref: string;
  /** The organization, so the flow is never rootless. */
  context?: string;
  title: string;
  /** e.g. "Step 1 of 2". Deliberately a line of text, not a progress widget. */
  step?: string;
  /**
   * The sticky footer: usually Back and Continue, or Publish. Optional, for
   * flows that already draw their own action row inside the content.
   */
  actions?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(FOCUS_CLASS);
    return () => root.classList.remove(FOCUS_CLASS);
  }, []);

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[720px] px-4 pt-4 sm:px-6 sm:pt-6",
        actions ? "pb-40" : "pb-24",
      )}
    >
      <header className="flex items-start gap-3">
        <Link
          aria-label="Leave this form"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground transition hover:border-kondo-green/40"
          href={backHref}
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          {context ? (
            <p className="truncate text-xs font-bold text-muted-foreground">
              {context}
            </p>
          ) : null}
          {/*
           * Wraps rather than truncates. "New opportunity" became
           * "New opportun…" beside the step counter, which reads like a bug.
           */}
          <h1 className="text-balance text-lg font-black leading-tight tracking-[-0.03em] sm:text-2xl">
            {title}
          </h1>
        </div>
        {step ? (
          <p className="shrink-0 pt-1 text-xs font-bold tabular-nums text-muted-foreground">
            {step}
          </p>
        ) : null}
      </header>

      <div className="mt-6">{children}</div>

      {/*
       * Above the safe area and above the keyboard, and only as wide as the
       * form it belongs to.
       */}
      {actions ? (
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl",
            "px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6",
          )}
        >
          <div className="mx-auto flex max-w-[720px] items-center gap-3">
            {actions}
          </div>
        </div>
      ) : null}
    </div>
  );
}
