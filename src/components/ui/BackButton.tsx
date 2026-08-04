"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useCallback } from "react";
import { LAST_MAIN_PATH_KEY, resolveSpaceExitPath } from "@/lib/space-exit";
import { cn } from "@/lib/utils";

/**
 * The circular back control shared by Kondo's dedicated spaces — organization
 * profiles and the Student Hub. Those surfaces drop the global navigation on
 * purpose, so this is the one way out and it has to read as a deliberate,
 * premium control rather than a leftover browser affordance.
 *
 * `overlay` sits on a cover image; `solid` sits on the page background. Both
 * carry the same Kondo green glow on hover and focus.
 */
export function BackButton({
  fallbackHref,
  exitPrefix,
  label = "Back",
  tone = "solid",
  className,
}: {
  /** Used when there is no in-app history, such as a direct landing. */
  fallbackHref: string;
  /**
   * Path prefix of the space this button leaves (e.g. "/student-hub"). When
   * set, the button always exits the space instead of stepping back one page
   * inside it.
   */
  exitPrefix?: string;
  label?: string;
  tone?: "solid" | "overlay";
  className?: string;
}) {
  const router = useRouter();

  const goBack = useCallback(() => {
    if (exitPrefix) {
      const exit = resolveSpaceExitPath(
        window.sessionStorage.getItem(LAST_MAIN_PATH_KEY),
        exitPrefix,
      );
      // Always a push, never history.back(): inside a space with its own tabs,
      // one step back is another page of the same space.
      router.push(exit ?? fallbackHref);
      return;
    }
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }, [exitPrefix, fallbackHref, router]);

  return (
    <button
      aria-label={label}
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-full border outline-none transition duration-300",
        "focus-visible:ring-4 focus-visible:ring-kondo-green/30 motion-reduce:transition-none",
        tone === "overlay"
          ? "border-white/25 bg-black/25 text-white shadow-[0_8px_30px_rgba(16,24,40,0.35)] backdrop-blur-xl hover:border-kondo-lime/70 hover:bg-black/35 hover:shadow-[0_10px_36px_rgb(var(--brand)/0.5)]"
          : "border-border bg-card text-foreground shadow-sm hover:border-kondo-green hover:text-kondo-green hover:shadow-[0_10px_30px_rgb(var(--brand)/0.28)]",
        className,
      )}
      onClick={goBack}
      type="button"
    >
      <ArrowLeft aria-hidden="true" className="h-5 w-5" />
    </button>
  );
}
