import type { OnboardingIntent } from "@prisma/client";

type OnboardingRouteState = {
  onboardingCompletedAt?: Date | null;
  onboardingIntent?: OnboardingIntent | null;
  organizationMemberships?: Array<{
    role: string;
    status: string;
    organization: {
      lifecycleStatus: string;
      setupCompletedAt: Date | null;
    };
  }>;
};

export function resolveSignedInLanding(state: OnboardingRouteState) {
  if (state.onboardingCompletedAt) return "/home";
  const unfinishedOwnedOrganization = state.organizationMemberships?.some(
    (membership) =>
      membership.role === "OWNER" &&
      membership.status === "ACTIVE" &&
      membership.organization.lifecycleStatus === "DRAFT" &&
      !membership.organization.setupCompletedAt,
  );
  if (unfinishedOwnedOrganization) {
    return "/onboarding/organization";
  }
  const completedOrganization = state.organizationMemberships?.some(
    (membership) =>
      membership.status === "ACTIVE" &&
      Boolean(membership.organization.setupCompletedAt),
  );
  if (state.onboardingIntent === "ORGANIZATION") {
    return completedOrganization ? "/home" : "/onboarding/organization";
  }
  return "/onboarding/personal";
}
