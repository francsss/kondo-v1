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
};

export type NavigatorAction = {
  key: string;
  title: string;
  reason: string;
  href: string;
  label: string;
  priority: NavigatorPriority;
};

type NavigatorRule = {
  action: NavigatorAction;
  when: (context: NavigatorContext) => boolean;
};

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
] as const;

export const NAVIGATOR_ACTION_KEYS = NAVIGATOR_RULES.map(
  ({ action }) => action.key,
);

export function evaluateNavigatorRules(context: NavigatorContext) {
  return NAVIGATOR_RULES.filter((rule) => rule.when(context))
    .map(({ action }) => action)
    .sort((left, right) =>
      left.priority === right.priority
        ? 0
        : left.priority === "REQUIRED"
          ? -1
          : 1,
    );
}
