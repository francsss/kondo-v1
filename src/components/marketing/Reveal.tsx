"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A section that arrives as you reach it.
 *
 * One IntersectionObserver and a transform — no animation library, no scroll
 * listener, nothing that runs on every frame. The observer disconnects after
 * the first reveal, so a long page costs a handful of one-shot callbacks
 * rather than continuous work.
 *
 * Content is never hidden by this. The "from" state is written entirely in
 * `motion-safe:` utilities, so a reader who prefers reduced motion is never
 * given `opacity-0` in the first place — no observer needed to rescue them —
 * and a reader whose JavaScript never arrives keeps the CSS default, which is
 * visible. Motion is the enhancement, not the gate: a landing page that needs
 * JS to show its text is a broken one.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** Small stagger, in ms, for items in the same row. Keep it under ~150. */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cn(
        "motion-safe:transition-[opacity,transform] motion-safe:duration-700 motion-safe:ease-out",
        shown
          ? "opacity-100 motion-safe:translate-y-0"
          : "motion-safe:translate-y-4 motion-safe:opacity-0",
        className,
      )}
      ref={ref}
      style={shown && delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
