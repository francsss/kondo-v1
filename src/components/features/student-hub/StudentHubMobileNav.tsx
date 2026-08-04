"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { STUDENT_HUB_PILLARS } from "@/components/features/student-hub/StudentHubShell";
import { cn } from "@/lib/utils";

/**
 * The Student Hub's own bottom navigation.
 *
 * The hub drops Kondo's global shell on purpose, so on a phone it needs its
 * own way to move between pillars. It mirrors the main bar's architecture —
 * equal columns, icon over label, one-handed reach, safe-area aware — while
 * naming the four places that exist inside this environment rather than the
 * ones outside it.
 */
export function StudentHubMobileNav({
  activeModule,
}: {
  activeModule: string;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <nav
      aria-label="Student Hub navigation"
      className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 rounded-3xl border border-border bg-card/95 p-1.5 text-card-foreground shadow-[0_16px_50px_rgba(16,24,40,0.2)] backdrop-blur-xl lg:hidden"
    >
      {STUDENT_HUB_PILLARS.map(({ key, href, shortLabel, label, Icon }) => {
        const active = key === activeModule;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            aria-label={label}
            className={cn(
              "relative isolate flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-bold transition-colors",
              active
                ? "text-kondo-forest dark:text-emerald-200"
                : "text-muted-foreground/70",
            )}
            href={href}
            key={key}
          >
            {active ? (
              <motion.span
                aria-hidden="true"
                className="absolute inset-0 -z-10 rounded-2xl bg-kondo-mint dark:bg-emerald-400/10"
                layoutId="student-hub-mobile-pill"
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 34 }
                }
              />
            ) : null}
            <Icon
              aria-hidden="true"
              className={cn(
                "h-[18px] w-[18px] transition-transform duration-300 motion-reduce:transition-none",
                active && "scale-110",
              )}
            />
            <span className="max-w-full truncate px-1">{shortLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
