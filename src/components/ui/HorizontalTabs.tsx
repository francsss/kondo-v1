"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type HorizontalTab = {
  key: string;
  href: string;
  label: string;
  /** Rendered after the label, e.g. a count or a lock. */
  badge?: React.ReactNode;
};

/**
 * Scrollable horizontal navigation shared by the Student Hub and the
 * organization Opportunities workspace.
 *
 * These are real links, not in-page panels, so the accessible pattern is a
 * labelled `nav` with `aria-current` rather than tablist/tab roles — announcing
 * a route change as a tab selection would be a lie to assistive technology.
 * The row scrolls horizontally on narrow screens while the page itself never
 * does, and the active tab is scrolled into view on mount and on navigation.
 */
export function HorizontalTabs({
  ariaLabel,
  tabs,
  activeKey,
  className,
}: {
  ariaLabel: string;
  tabs: readonly HorizontalTab[];
  activeKey: string | null;
  className?: string;
}) {
  const containerRef = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !activeKey) return;
    const active = container.querySelector<HTMLElement>(
      `[data-tab-key="${CSS.escape(activeKey)}"]`,
    );
    if (!active) return;
    // Only correct the inline axis, and never steal focus: scrolling the block
    // axis here would yank the page whenever a tab row sits below the fold.
    const containerBox = container.getBoundingClientRect();
    const activeBox = active.getBoundingClientRect();
    const overflowsLeft = activeBox.left < containerBox.left;
    const overflowsRight = activeBox.right > containerBox.right;
    if (!overflowsLeft && !overflowsRight) return;
    container.scrollTo({
      left:
        active.offsetLeft - (container.clientWidth - active.clientWidth) / 2,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [activeKey, reducedMotion]);

  return (
    <nav
      aria-label={ariaLabel}
      className={cn("subnav-row gap-1", className)}
      ref={containerRef}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative isolate inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              active
                ? "text-kondo-forest dark:text-emerald-200"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
            data-tab-key={tab.key}
            href={tab.href}
            key={tab.key}
          >
            {active ? (
              <motion.span
                aria-hidden="true"
                className="absolute inset-0 -z-10 rounded-full bg-kondo-mint dark:bg-emerald-400/10"
                layoutId={`horizontal-tab-${ariaLabel}`}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 34 }
                }
              />
            ) : null}
            {tab.label}
            {tab.badge}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Subtle directional transition between adjacent tab panels: content for a tab
 * to the right enters from the right, and vice versa. Purely presentational —
 * the content is already server-rendered and remains vertically readable, so a
 * reduced-motion visitor simply gets no movement.
 */
export function TabPanelTransition({
  children,
  index,
  className,
}: {
  children: React.ReactNode;
  /** Position of the active tab, used only to derive the direction. */
  index: number;
  className?: string;
}) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  // Adjusting state during render is the supported way to derive a value from
  // a prop change; a ref read during render would be a stale-value hazard.
  const [tracked, setTracked] = useState({ index, direction: 1 });
  const direction =
    tracked.index === index
      ? tracked.direction
      : index > tracked.index
        ? 1
        : -1;
  if (tracked.index !== index) {
    setTracked({ index, direction });
  }

  if (reducedMotion) return <div className={className}>{children}</div>;

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        animate={{ opacity: 1, x: 0 }}
        className={className}
        exit={{ opacity: 0 }}
        initial={{ opacity: 0, x: direction * 12 }}
        key={pathname}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
