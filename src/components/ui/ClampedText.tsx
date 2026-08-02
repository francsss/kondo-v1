"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Reusable text clamping.
 *
 * Long titles and descriptions must not turn a card into a column of its own,
 * but truncation is a *presentation* decision: the complete text is always
 * rendered into the DOM and simply clipped by CSS, so assistive technology,
 * search and copy-paste keep the real content. Nothing is ever shortened at the
 * API or database level for layout reasons.
 */

const LINE_CLAMP_CLASS: Record<number, string> = {
  1: "line-clamp-1",
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
};

// Written out rather than interpolated so Tailwind can see every class name.
const MOBILE_LINE_CLAMP_CLASS: Record<number, string> = {
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
};

const DESKTOP_LINE_CLAMP_CLASS: Record<number, string> = {
  2: "sm:line-clamp-2",
  3: "sm:line-clamp-3",
  4: "sm:line-clamp-4",
  5: "sm:line-clamp-5",
  6: "sm:line-clamp-6",
};

/**
 * Titles clamp without an expander: a card title that grows on click would
 * reflow every neighbour in the grid for very little gain.
 */
export function ClampedTitle({
  children,
  className,
  lines = 2,
}: {
  children: React.ReactNode;
  className?: string;
  lines?: 1 | 2 | 3;
}) {
  return (
    <span className={cn(LINE_CLAMP_CLASS[lines], className)}>{children}</span>
  );
}

/**
 * Description text collapsed to `lines`, with an in-place See more / See less
 * control that appears only when the text is genuinely truncated.
 */
export function ExpandableText({
  text,
  className,
  lines = 4,
  mobileLines,
  moreLabel = "See more",
  lessLabel = "See less",
  collapsible = true,
}: {
  text: string;
  className?: string;
  /** Lines shown on tablet and desktop. */
  lines?: 2 | 3 | 4 | 5 | 6;
  /**
   * Lines shown on a phone. A feed is much harder to browse when every post
   * takes a full screen, so mobile clamps tighter by default.
   */
  mobileLines?: 2 | 3 | 4 | 5 | 6;
  moreLabel?: string;
  lessLabel?: string;
  /** Detail pages pass false to show complete content with no control. */
  collapsible?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const contentId = useId();

  const measure = useCallback(() => {
    const node = textRef.current;
    if (!node || !collapsible) return;
    // Measured while collapsed only: expanded content always fits itself.
    if (expanded) return;
    setTruncated(node.scrollHeight - node.clientHeight > 1);
  }, [collapsible, expanded]);

  useEffect(() => {
    measure();
    // A clamped element keeps a constant height, so a font swap changes how
    // much text fits without resizing anything. Re-measure once fonts settle,
    // otherwise a control can appear (or fail to appear) and then never
    // correct itself.
    let cancelled = false;
    document.fonts?.ready
      .then(() => {
        if (!cancelled) measure();
      })
      .catch(() => undefined);

    if (typeof ResizeObserver === "undefined") {
      return () => {
        cancelled = true;
      };
    }
    const node = textRef.current;
    if (!node) {
      return () => {
        cancelled = true;
      };
    }
    // A narrower card truncates text that fitted a moment earlier.
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [measure, text]);

  if (!collapsible) {
    return <p className={className}>{text}</p>;
  }

  return (
    <div>
      <p
        className={cn(
          !expanded && [
            // Tighter on a phone, roomier from `sm` upwards.
            mobileLines
              ? MOBILE_LINE_CLAMP_CLASS[mobileLines]
              : LINE_CLAMP_CLASS[lines],
            mobileLines && DESKTOP_LINE_CLAMP_CLASS[lines],
          ],
          // Expansion happens in place: the paragraph grows, the card reflows
          // around it, and nothing above the control moves.
          "transition-[max-height] duration-300 ease-out motion-reduce:transition-none",
          className,
        )}
        id={contentId}
        ref={textRef}
      >
        {text}
      </p>
      {truncated ? (
        <button
          aria-controls={contentId}
          aria-expanded={expanded}
          className="mt-1 inline-flex min-h-8 items-center rounded-full text-xs font-black text-kondo-green transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {expanded ? lessLabel : moreLabel}
        </button>
      ) : null}
    </div>
  );
}
