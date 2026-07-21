"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LiveActivityStream } from "@/components/features/activity/LiveActivityStream";
import { PostComposer } from "@/components/features/community/PostComposer";
import type { HomeActivityItem } from "@/features/activity/types";
import { cn } from "@/lib/utils";

type CommunityOption = {
  id: string;
  name: string;
  icon: string | null;
  canAnnounce?: boolean;
};

export function HomeActivityIntro({
  activities,
  chinaDate,
  communities,
  firstName,
  generatedAt,
}: {
  activities: HomeActivityItem[];
  chinaDate: string;
  communities: CommunityOption[];
  firstName: string;
  generatedAt: string;
}) {
  const reducedMotion = useReducedMotion();
  const activityRef = useRef<HTMLDivElement>(null);
  const welcomeRef = useRef<HTMLElement>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);

  useEffect(() => {
    const reveal = window.setTimeout(() => setShowActivity(true), 2_400);
    return () => window.clearTimeout(reveal);
  }, []);

  useLayoutEffect(() => {
    const target = showActivity ? activityRef.current : welcomeRef.current;
    if (!target) return;

    const updateHeight = () => setContainerHeight(target.scrollHeight);
    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(target);
    return () => resizeObserver.disconnect();
  }, [showActivity]);

  const transition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.58, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <motion.div
      animate={
        showActivity && containerHeight !== null
          ? { height: containerHeight }
          : {}
      }
      className={cn(
        "relative",
        containerHeight === null && "min-h-[150px] sm:min-h-[96px]",
      )}
      data-testid="home-activity-transition"
      initial={false}
      style={
        !showActivity && containerHeight !== null
          ? { height: containerHeight }
          : undefined
      }
      transition={transition}
    >
      <motion.section
        animate={
          showActivity
            ? {
                opacity: 0,
                scale: 0.99,
                transitionEnd: { visibility: "hidden" },
                y: -12,
              }
            : { opacity: 1, scale: 1, visibility: "visible", y: 0 }
        }
        aria-hidden={showActivity}
        className={cn(
          "absolute inset-x-0 top-0 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between",
          showActivity && "pointer-events-none",
        )}
        initial={false}
        inert={showActivity}
        ref={welcomeRef}
        transition={transition}
      >
        <div>
          <p className="text-sm font-semibold text-kondo-green">{chinaDate}</p>
          <h1 className="mt-1 text-3xl font-black tracking-[-0.045em] text-kondo-ink dark:text-white sm:text-4xl">
            Welcome back, {firstName} <span aria-hidden="true">👋🏾</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Here’s what’s happening around your student life today.
          </p>
        </div>
        <PostComposer communities={communities} />
      </motion.section>

      <motion.div
        animate={
          showActivity
            ? { opacity: 1, scale: 1, visibility: "visible", y: 0 }
            : { opacity: 0, scale: 0.99, visibility: "hidden", y: 14 }
        }
        aria-hidden={!showActivity}
        className={cn(
          "absolute inset-x-0 top-0 min-w-0",
          !showActivity && "pointer-events-none",
        )}
        initial={false}
        inert={!showActivity}
        ref={activityRef}
        transition={{
          ...transition,
          delay: showActivity && !reducedMotion ? 0.08 : 0,
        }}
      >
        <LiveActivityStream
          generatedAt={generatedAt}
          initialActivities={activities}
        />
      </motion.div>
    </motion.div>
  );
}
