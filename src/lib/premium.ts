import { prisma } from "@/lib/prisma";

export type PremiumAccess = {
  active: boolean;
  status: string | null;
  planName: string | null;
  expiresAt: string | null;
  featureKeys: string[];
};

export async function getPremiumAccess(
  userId: string,
  now = new Date(),
): Promise<PremiumAccess> {
  const subscription = await prisma.userSubscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      OR: [{ currentPeriodEndsAt: null }, { currentPeriodEndsAt: { gt: now } }],
      plan: { active: true },
    },
    include: { plan: true },
    orderBy: [{ currentPeriodEndsAt: "desc" }, { createdAt: "desc" }],
  });

  if (!subscription) {
    return {
      active: false,
      status: null,
      planName: null,
      expiresAt: null,
      featureKeys: [],
    };
  }

  return {
    active: true,
    status: subscription.status,
    planName: subscription.plan.name,
    expiresAt: subscription.currentPeriodEndsAt?.toISOString() ?? null,
    featureKeys: subscription.plan.featureKeys,
  };
}

export function hasPremiumFeature(access: PremiumAccess, featureKey: string) {
  return access.active && access.featureKeys.includes(featureKey);
}
