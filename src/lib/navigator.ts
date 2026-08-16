import type { NavigatorActionState } from "@prisma/client";
import {
  evaluateNavigatorRules,
  NAVIGATOR_ACTION_KEYS,
} from "@/features/navigator/registry";
import { getGuideNextStep } from "@/lib/guide-journey";
import { getUserJourney } from "@/lib/journey-service";
import { publicHousingListingWhere } from "@/lib/housing-visibility";
import { publicOpportunityWhere } from "@/lib/opportunity-visibility";
import {
  publicOrganizationProductWhere,
  publicOrganizationServiceWhere,
} from "@/lib/organization-catalog-visibility";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";

export async function getNavigatorActions(userId: string) {
  const now = new Date();
  const [journey, user, counts, states] = await Promise.all([
    getUserJourney(userId),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        countryId: true,
        cityId: true,
        studyLevel: true,
        languages: true,
        opportunityProfile: {
          select: {
            preferredTypes: true,
            professionalInterests: true,
            skills: true,
          },
        },
      },
    }),
    Promise.all([
      prisma.communityMember.count({ where: { userId } }),
      prisma.community.count({ where: { status: "ACTIVE" } }),
      prisma.opportunity.count({
        where: { type: "SCHOLARSHIP", ...publicOpportunityWhere() },
      }),
      prisma.opportunity.count({
        where: {
          type: { in: ["INTERNSHIP", "GRADUATE_INTERNSHIP"] },
          ...publicOpportunityWhere(),
        },
      }),
      prisma.opportunity.count({
        where: {
          type: { in: ["PART_TIME_JOB", "FULL_TIME_JOB", "CAMPUS_JOB"] },
          ...publicOpportunityWhere(),
        },
      }),
      prisma.housingListing.count({ where: publicHousingListingWhere() }),
      prisma.organizationProduct.count({
        where: publicOrganizationProductWhere,
      }),
      prisma.organizationService.count({
        where: publicOrganizationServiceWhere,
      }),
      prisma.userOpportunityDocument.count({
        where: { userId, archivedAt: null },
      }),
      prisma.opportunityApplication.count({
        where: {
          applicantUserId: userId,
          status: { in: ["MORE_INFORMATION_REQUIRED", "INTERVIEW", "OFFERED"] },
        },
      }),
      prisma.studentSchedule.count({
        where: { ownerId: userId, isActive: true },
      }),
    ]),
    prisma.userNavigatorActionState.findMany({ where: { userId } }),
  ]);
  const [
    communityMembershipCount,
    publicCommunityCount,
    scholarshipCount,
    internshipCount,
    jobCount,
    housingCount,
    productCount,
    serviceCount,
    opportunityDocumentCount,
    activeApplicationActionCount,
    scheduleCount,
  ] = counts;
  const profileComplete = Boolean(
    user.firstName && user.lastName && user.countryId && user.languages.length,
  );
  const opportunityProfile = user.opportunityProfile;
  const professionalProfileComplete = Boolean(
    opportunityProfile &&
    (opportunityProfile.preferredTypes.length ||
      opportunityProfile.professionalInterests.length ||
      opportunityProfile.skills.length),
  );
  const byKey = new Map(states.map((state) => [state.actionKey, state]));
  /*
   * Resolved after the batch because it needs the stage that batch produces.
   * Reuses the same function Home uses for its next-step card, so the two
   * surfaces can never disagree about which step comes next.
   */
  const guideNextStep = await getGuideNextStep({
    userId,
    stage: journey.stage,
  });
  const actions = evaluateNavigatorRules({
    group: journey.group,
    stage: journey.stage,
    guideNextStep: guideNextStep
      ? {
          guideTitle: guideNextStep.guideTitle,
          stepTitle: guideNextStep.stepTitle,
          completed: guideNextStep.completed,
          total: guideNextStep.total,
          href: guideNextStep.href,
        }
      : null,
    profileComplete,
    communityMembershipCount,
    publicCommunityCount,
    scholarshipCount,
    internshipCount,
    jobCount,
    housingCount,
    essentialCount: productCount + serviceCount,
    opportunityDocumentCount,
    professionalProfileComplete,
    activeApplicationActionCount,
    scheduleCount,
  }).filter((action) => {
    const state = byKey.get(action.key);
    if (!state) return true;
    if (state.state === "DEFERRED")
      return !state.deferredUntil || state.deferredUntil <= now;
    return false;
  });
  return { journey, actions: actions.slice(0, 4), total: actions.length };
}

export async function setNavigatorActionState(input: {
  userId: string;
  actionKey: string;
  state: NavigatorActionState;
  deferDays?: number;
}) {
  if (!NAVIGATOR_ACTION_KEYS.includes(input.actionKey)) {
    throw new Error("Unknown Navigator action.");
  }
  const deferredUntil =
    input.state === "DEFERRED"
      ? new Date(
          Date.now() +
            Math.min(14, Math.max(1, input.deferDays ?? 3)) * 86_400_000,
        )
      : null;
  const result = await prisma.userNavigatorActionState.upsert({
    where: {
      userId_actionKey: { userId: input.userId, actionKey: input.actionKey },
    },
    create: {
      userId: input.userId,
      actionKey: input.actionKey,
      state: input.state,
      deferredUntil,
    },
    update: { state: input.state, deferredUntil },
    select: { actionKey: true, state: true, deferredUntil: true },
  });
  const event =
    input.state === "COMPLETED"
      ? PRODUCT_EVENTS.NAVIGATOR_ACTION_COMPLETED
      : input.state === "DISMISSED"
        ? PRODUCT_EVENTS.NAVIGATOR_ACTION_DISMISSED
        : PRODUCT_EVENTS.NAVIGATOR_ACTION_DEFERRED;
  await captureServerProductEvent({
    distinctId: input.userId,
    event,
    properties: { action_key: input.actionKey },
  });
  return result;
}
