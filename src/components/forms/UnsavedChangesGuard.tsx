"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

type PendingNavigation =
  { kind: "href"; href: string } | { kind: "back" } | null;

/**
 * Protects editable client forms from accidental internal-link, browser-back,
 * refresh, and tab-close navigation. The custom dialog covers SPA navigation;
 * beforeunload remains the browser-safe fallback for page exits.
 */
export function UnsavedChangesGuard({ isDirty }: { isDirty: boolean }) {
  const router = useRouter();
  const [pendingNavigation, setPendingNavigation] =
    useState<PendingNavigation>(null);
  const restoringAfterBlockedBack = useRef(false);
  const allowNextPop = useRef(false);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const interceptLink = (event: MouseEvent) => {
      if (!isDirty || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);
      if (destination.origin !== current.origin) return;
      if (
        destination.pathname === current.pathname &&
        destination.search === current.search &&
        destination.hash === current.hash
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation({
        kind: "href",
        href: `${destination.pathname}${destination.search}${destination.hash}`,
      });
    };

    const interceptBack = () => {
      if (allowNextPop.current) {
        allowNextPop.current = false;
        return;
      }
      if (restoringAfterBlockedBack.current) {
        restoringAfterBlockedBack.current = false;
        return;
      }
      if (!isDirty) return;

      restoringAfterBlockedBack.current = true;
      window.history.forward();
      setPendingNavigation({ kind: "back" });
    };

    document.addEventListener("click", interceptLink, true);
    window.addEventListener("popstate", interceptBack);
    return () => {
      document.removeEventListener("click", interceptLink, true);
      window.removeEventListener("popstate", interceptBack);
    };
  }, [isDirty]);

  function continueEditing() {
    setPendingNavigation(null);
  }

  function leaveWithoutSaving() {
    const navigation = pendingNavigation;
    setPendingNavigation(null);

    if (navigation?.kind === "back") {
      allowNextPop.current = true;
      window.history.back();
      return;
    }
    if (navigation?.kind === "href") {
      router.push(navigation.href);
    }
  }

  if (!pendingNavigation) return null;

  return (
    <div
      aria-labelledby="unsaved-changes-title"
      aria-modal="true"
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-2xl">
        <h2 className="text-xl font-black" id="unsaved-changes-title">
          Unsaved changes
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          You have unsaved changes. If you leave now, they will be lost.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button onClick={leaveWithoutSaving} type="button" variant="ghost">
            Leave without saving
          </Button>
          <Button autoFocus onClick={continueEditing} type="button">
            Continue editing
          </Button>
        </div>
      </div>
    </div>
  );
}
