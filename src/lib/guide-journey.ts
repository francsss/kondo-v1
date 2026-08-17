import type { GuideCategory, KondoJourneyStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readableGuideWhere } from "@/lib/guide-trust";

/**
 * Which part of the Guide matters to a student right now.
 *
 * Kondo already knows where someone is — the Journey stage is recorded at
 * onboarding and maintained since — and the Guide is already organised by the
 * same real-world phases. Nothing new needs modelling: the two only had to be
 * introduced to each other.
 *
 * A student preparing to fly does not need the healthcare guide first, and one
 * who has been in Beijing for a year does not need the packing checklist. This
 * decides the order, never the availability: every category stays reachable,
 * because the point is to save someone a search, not to decide for them.
 */

/**
 * Categories in priority order per stage, most useful first.
 *
 * Written per stage rather than per group because the difference between
 * ADMITTED and NEW_ARRIVAL is exactly the difference between "what do I pack"
 * and "how do I register" — which is the whole reason the stages exist.
 */
const CATEGORY_PRIORITY: Partial<
  Record<KondoJourneyStage, readonly GuideCategory[]>
> = {
  EXPLORING: ["UNIVERSITY", "BEFORE_DEPARTURE", "MONEY"],
  PREPARING_APPLICATION: ["UNIVERSITY", "BEFORE_DEPARTURE", "MONEY"],
  APPLICATION_SUBMITTED: ["UNIVERSITY", "BEFORE_DEPARTURE", "MONEY"],
  WAITING_FOR_DECISION: ["BEFORE_DEPARTURE", "UNIVERSITY", "MONEY"],
  // Admitted but not yet travelling: the preparation window.
  ADMITTED: ["BEFORE_DEPARTURE", "MONEY", "ARRIVAL", "UNIVERSITY"],
  PREPARING_ARRIVAL: ["BEFORE_DEPARTURE", "ARRIVAL", "MONEY", "TRANSPORT"],
  // Just landed: the paperwork and the practicalities, in that order.
  NEW_ARRIVAL: ["ARRIVAL", "RESIDENCY", "MONEY", "TRANSPORT", "UNIVERSITY"],
  CURRENT_STUDENT: ["UNIVERSITY", "DAILY_LIFE", "RESIDENCY", "TRANSPORT"],
  INTERNSHIP_PREPARATION: ["UNIVERSITY", "RESIDENCY", "DAILY_LIFE"],
  FINAL_YEAR: ["UNIVERSITY", "RESIDENCY", "DAILY_LIFE"],
  GRADUATING: ["RESIDENCY", "UNIVERSITY", "DAILY_LIFE"],
  JOB_SEEKING: ["RESIDENCY", "DAILY_LIFE", "MONEY"],
  EMPLOYED: ["RESIDENCY", "DAILY_LIFE", "MONEY"],
  ALUMNI: ["RESIDENCY", "DAILY_LIFE"],
  PROFESSIONAL: ["RESIDENCY", "DAILY_LIFE", "MONEY"],
  ENTREPRENEUR: ["RESIDENCY", "MONEY", "DAILY_LIFE"],
};

/** Sensible order when a stage has no opinion, so nothing ever falls through. */
const DEFAULT_PRIORITY: readonly GuideCategory[] = [
  "BEFORE_DEPARTURE",
  "ARRIVAL",
  "RESIDENCY",
  "MONEY",
  "UNIVERSITY",
  "TRANSPORT",
  "DAILY_LIFE",
  "HEALTH",
];

export function guideCategoryPriority(stage: KondoJourneyStage | null) {
  return stage
    ? (CATEGORY_PRIORITY[stage] ?? DEFAULT_PRIORITY)
    : DEFAULT_PRIORITY;
}

export type GuideNextStep = {
  guideSlug: string;
  guideTitle: string;
  /** The step to do next, or null when the whole guide is done. */
  stepTitle: string | null;
  completed: number;
  total: number;
  /** Where the reader is sent. */
  href: string;
};

/**
 * The single most useful unfinished guide for this student, and where they are
 * in it.
 *
 * Progress is read from `GuideProgress`, which already records a completed step
 * per user — there was no need for a second checklist model, and building one
 * would have split the same fact across two tables.
 *
 * Finished guides are skipped rather than re-offered: a student who has done
 * every step of the arrival checklist should be shown the next thing, not
 * congratulated repeatedly on the last one.
 */
export async function getGuideNextStep(input: {
  userId: string;
  stage: KondoJourneyStage | null;
}): Promise<GuideNextStep | null> {
  const priority = guideCategoryPriority(input.stage);

  const guides = await prisma.guide.findMany({
    where: { ...readableGuideWhere, category: { in: [...priority] } },
    select: {
      slug: true,
      title: true,
      category: true,
      steps: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          progress: {
            where: { userId: input.userId },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
    // Bounded: this runs on Home, so it must stay small and predictable.
    take: 24,
  });

  const ranked = guides
    .filter((guide) => guide.steps.length)
    .map((guide) => {
      const completed = guide.steps.filter(
        (step) => step.progress.length,
      ).length;
      return {
        guide,
        completed,
        total: guide.steps.length,
        rank: priority.indexOf(guide.category),
        next: guide.steps.find((step) => !step.progress.length) ?? null,
      };
    })
    // Anything already finished is not a next step.
    .filter((entry) => entry.next)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        // Among equals, the one already started — finishing beats starting.
        b.completed - a.completed ||
        a.guide.slug.localeCompare(b.guide.slug),
    );

  const best = ranked[0];
  if (!best) return null;

  return {
    guideSlug: best.guide.slug,
    guideTitle: best.guide.title,
    stepTitle: best.next?.title ?? null,
    completed: best.completed,
    total: best.total,
    href: `/student-hub/guide/${best.guide.slug}`,
  };
}
