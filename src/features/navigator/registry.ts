import type { KondoJourneyGroup, KondoJourneyStage } from "@prisma/client";

export type NavigatorPriority = "REQUIRED" | "RECOMMENDED";

export type NavigatorContext = {
  group: KondoJourneyGroup;
  stage: KondoJourneyStage;
  profileComplete: boolean;
  communityMembershipCount: number;
  publicCommunityCount: number;
  scholarshipCount: number;
  internshipCount: number;
  jobCount: number;
  housingCount: number;
  essentialCount: number;
  opportunityDocumentCount: number;
  professionalProfileComplete: boolean;
  activeApplicationActionCount: number;
  scheduleCount: number;
  /**
   * The most useful unfinished guide step for this member, already resolved by
   * `getGuideNextStep`. Null when every relevant guide is finished — which is
   * the case the Navigator must not paper over with a generic "read the guide".
   */
  guideNextStep: {
    guideTitle: string;
    stepTitle: string | null;
    completed: number;
    total: number;
    href: string;
  } | null;
};

export type NavigatorAction = {
  key: string;
  title: string;
  reason: string;
  href: string;
  label: string;
  priority: NavigatorPriority;
};

/**
 * A rule's action may be a function of the context.
 *
 * Almost every action is a fixed link to a section, so the plain object form
 * stays. The Guide is the exception: "continue the checklist" is only useful if
 * it opens the specific guide and names the specific step, which is not
 * knowable until the member's progress has been read.
 */
type NavigatorRule =
  | { action: NavigatorAction; when: (context: NavigatorContext) => boolean }
  | {
      /** Declared separately, because a computed action has no literal key. */
      key: string;
      action: (context: NavigatorContext) => NavigatorAction;
      when: (context: NavigatorContext) => boolean;
    };

function ruleKey(rule: NavigatorRule) {
  return "key" in rule ? rule.key : rule.action.key;
}

function resolveAction(
  rule: NavigatorRule,
  context: NavigatorContext,
): NavigatorAction {
  return typeof rule.action === "function" ? rule.action(context) : rule.action;
}

const preparing = (context: NavigatorContext) =>
  context.group === "PREPARING_FOR_CHINA";
const studying = (context: NavigatorContext) =>
  context.group === "STUDYING_AND_LIVING_IN_CHINA";
const career = (context: NavigatorContext) =>
  context.group === "CAREER_ALUMNI_AND_ENTREPRENEURSHIP";

export const NAVIGATOR_RULES: readonly NavigatorRule[] = [
  {
    action: {
      key: "complete-profile",
      title: "Complete your personal profile",
      reason:
        "A complete profile makes community and opportunity context more useful.",
      href: "/profile/edit",
      label: "Complete profile",
      priority: "REQUIRED",
    },
    when: (context) => !context.profileComplete,
  },
  {
    action: {
      key: "review-application-actions",
      title: "Review your application updates",
      reason: "One or more active applications need your attention.",
      href: "/student-hub/applications",
      label: "Review applications",
      priority: "REQUIRED",
    },
    when: (context) => context.activeApplicationActionCount > 0,
  },
  {
    action: {
      key: "explore-scholarships",
      title: "Explore scholarships",
      reason:
        "Published scholarships are available for students preparing for China.",
      href: "/student-hub/scholarships",
      label: "View scholarships",
      priority: "RECOMMENDED",
    },
    when: (context) => preparing(context) && context.scholarshipCount > 0,
  },
  {
    action: {
      key: "prepare-housing",
      title: "Plan where you will live",
      reason: "Published housing is available to compare before arrival.",
      href: "/housing/search",
      label: "Search housing",
      priority: "RECOMMENDED",
    },
    when: (context) =>
      preparing(context) &&
      ["ADMITTED", "PREPARING_ARRIVAL"].includes(context.stage) &&
      context.housingCount > 0,
  },
  {
    action: {
      key: "arrival-essentials",
      title: "Review arrival essentials",
      reason: "Real student services are available for your arrival context.",
      href: "/discover/essentials",
      label: "Open essentials",
      priority: "RECOMMENDED",
    },
    when: (context) => preparing(context) && context.essentialCount > 0,
  },
  {
    action: {
      key: "join-community",
      title: "Join a community",
      reason: "Communities connect you with students who share your context.",
      href: "/communities",
      label: "Explore communities",
      priority: "RECOMMENDED",
    },
    when: (context) =>
      context.communityMembershipCount === 0 &&
      context.publicCommunityCount > 0,
  },
  {
    action: {
      key: "set-up-schedule",
      title: "Set up your study schedule",
      reason:
        "Your Student Hub has schedule tools, but no active schedule yet.",
      href: "/student-hub/tools",
      label: "Open My Tools",
      priority: "RECOMMENDED",
    },
    when: (context) => studying(context) && context.scheduleCount === 0,
  },
  {
    action: {
      key: "explore-internships",
      title: "Explore internships",
      reason: "Published internships are available for practical experience.",
      href: "/student-hub/internships",
      label: "View internships",
      priority: "RECOMMENDED",
    },
    when: (context) =>
      studying(context) &&
      ["INTERNSHIP_PREPARATION", "FINAL_YEAR"].includes(context.stage) &&
      context.internshipCount > 0,
  },
  {
    action: {
      key: "complete-career-profile",
      title: "Complete your opportunity profile",
      reason: "Your private professional preferences are not complete yet.",
      href: "/opportunities/profile",
      label: "Complete career profile",
      priority: "RECOMMENDED",
    },
    when: (context) => career(context) && !context.professionalProfileComplete,
  },
  {
    action: {
      key: "add-cv",
      title: "Add a CV to your private documents",
      reason: "A reusable CV can make future applications faster.",
      href: "/opportunities/documents",
      label: "Add a document",
      priority: "RECOMMENDED",
    },
    when: (context) =>
      career(context) && context.opportunityDocumentCount === 0,
  },
  {
    action: {
      key: "explore-jobs",
      title: "Explore current jobs",
      reason: "Published jobs are available in Kondo right now.",
      href: "/student-hub/jobs",
      label: "View jobs",
      priority: "RECOMMENDED",
    },
    when: (context) => career(context) && context.jobCount > 0,
  },
  /*
   * The Guide was the one part of Kondo the Navigator never pointed at, which
   * left two checklists side by side that did not know about each other: the
   * Navigator told you to sort your housing, and the Guide held the steps for
   * doing it.
   *
   * This action names the actual next step and links to the actual guide, so
   * it is a continuation rather than a suggestion to go and look. It appears
   * only when a real unfinished step exists — when everything relevant is
   * done, the Navigator says nothing rather than inventing a task.
   */
  {
    key: "continue-guide",
    action: (context) => {
      const next = context.guideNextStep;
      return {
        key: "continue-guide",
        title: next?.stepTitle
          ? `Next in ${next.guideTitle}: ${next.stepTitle}`
          : "Continue your Kondo Guide",
        reason: next
          ? `${next.completed} of ${next.total} steps done in this guide.`
          : "A guide for your stage is waiting.",
        href: next?.href ?? "/student-hub/guide",
        label: next?.completed ? "Continue guide" : "Start guide",
        priority: "RECOMMENDED",
      };
    },
    when: (context) => context.guideNextStep !== null,
  },
] as const satisfies readonly NavigatorRule[];

export const NAVIGATOR_ACTION_KEYS = NAVIGATOR_RULES.map(ruleKey);

export function evaluateNavigatorRules(context: NavigatorContext) {
  return NAVIGATOR_RULES.filter((rule) => rule.when(context))
    .map((rule) => resolveAction(rule, context))
    .sort((left, right) =>
      left.priority === right.priority
        ? 0
        : left.priority === "REQUIRED"
          ? -1
          : 1,
    );
}
