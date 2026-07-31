import { trackEvent } from "@/lib/analytics";
import {
  opportunityCardSelect,
  serializeOpportunityCard,
  OpportunityError,
} from "@/lib/opportunities";
import { revalidateOpportunity } from "@/lib/opportunity-cache";
import { publicOpportunityWhere } from "@/lib/opportunity-visibility";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";

/**
 * Saved opportunities.
 *
 * Saves are private to the user. Publishers never see who saved an
 * opportunity, and no aggregate save count is exposed publicly, so a save
 * total can never turn into a fabricated popularity signal.
 *
 * Deadline reminders are strictly opt-in: `remindBeforeDays` stays null unless
 * the user chooses a lead time.
 */

const ALLOWED_REMINDER_DAYS = [14, 7, 3, 1] as const;

export function isAllowedReminderLeadTime(days: number) {
  return (ALLOWED_REMINDER_DAYS as readonly number[]).includes(days);
}

export async function saveOpportunity(input: {
  userId: string;
  opportunityId: string;
  remindBeforeDays?: number | null;
}) {
  const opportunity = await prisma.opportunity.findFirst({
    where: { id: input.opportunityId, ...publicOpportunityWhere() },
    select: { id: true, type: true },
  });
  if (!opportunity) {
    throw new OpportunityError("Opportunity not found.", 404);
  }
  const remindBeforeDays =
    typeof input.remindBeforeDays === "number" &&
    isAllowedReminderLeadTime(input.remindBeforeDays)
      ? input.remindBeforeDays
      : null;

  await prisma.opportunitySaved.upsert({
    where: {
      userId_opportunityId: {
        userId: input.userId,
        opportunityId: input.opportunityId,
      },
    },
    create: {
      userId: input.userId,
      opportunityId: input.opportunityId,
      remindBeforeDays,
    },
    // A repeat save is idempotent and never creates a duplicate row.
    update: { remindBeforeDays },
  });

  await Promise.all([
    trackEvent({
      name: "OPPORTUNITY_SAVED",
      userId: input.userId,
      properties: { opportunityType: opportunity.type },
    }),
    captureServerProductEvent({
      distinctId: input.userId,
      event: PRODUCT_EVENTS.OPPORTUNITY_SAVED,
      properties: { opportunity_type: opportunity.type },
    }),
  ]);
  return { saved: true, remindBeforeDays };
}

export async function unsaveOpportunity(input: {
  userId: string;
  opportunityId: string;
}) {
  await prisma.opportunitySaved.deleteMany({
    where: { userId: input.userId, opportunityId: input.opportunityId },
  });
  await trackEvent({
    name: "OPPORTUNITY_UNSAVED",
    userId: input.userId,
    properties: {},
  });
  return { saved: false };
}

/**
 * Visibility is re-checked on read, so an opportunity that was removed or
 * whose organization was suspended after being saved shows a safe unavailable
 * state instead of leaking a hidden record.
 */
export async function listSavedOpportunities(input: {
  userId: string;
  limit?: number;
  now?: Date;
}) {
  const rows = await prisma.opportunitySaved.findMany({
    where: { userId: input.userId },
    select: {
      createdAt: true,
      remindBeforeDays: true,
      opportunity: { select: opportunityCardSelect },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(100, Math.max(1, input.limit ?? 50)),
  });

  const visibleIds = new Set(
    (
      await prisma.opportunity.findMany({
        where: {
          id: { in: rows.map((row) => row.opportunity.id) },
          ...publicOpportunityWhere({ scope: "HISTORICAL" }),
        },
        select: { id: true },
      })
    ).map(({ id }) => id),
  );

  return rows.map((row) => {
    const available = visibleIds.has(row.opportunity.id);
    return {
      savedAt: row.createdAt.toISOString(),
      remindBeforeDays: row.remindBeforeDays,
      available,
      opportunity: available
        ? serializeOpportunityCard(row.opportunity, input.now)
        : null,
      unavailableTitle: available ? null : row.opportunity.title,
    };
  });
}

export async function isOpportunitySaved(input: {
  userId: string;
  opportunityId: string;
}) {
  const row = await prisma.opportunitySaved.findUnique({
    where: {
      userId_opportunityId: {
        userId: input.userId,
        opportunityId: input.opportunityId,
      },
    },
    select: { createdAt: true },
  });
  return Boolean(row);
}

export async function setSavedOpportunityReminder(input: {
  userId: string;
  opportunityId: string;
  remindBeforeDays: number | null;
}) {
  if (
    input.remindBeforeDays !== null &&
    !isAllowedReminderLeadTime(input.remindBeforeDays)
  ) {
    throw new OpportunityError("Choose a supported reminder lead time.", 400);
  }
  const updated = await prisma.opportunitySaved.updateMany({
    where: { userId: input.userId, opportunityId: input.opportunityId },
    data: { remindBeforeDays: input.remindBeforeDays },
  });
  if (updated.count === 0) {
    throw new OpportunityError("Save this opportunity first.", 404);
  }
  revalidateOpportunity({ opportunityId: input.opportunityId });
  return { remindBeforeDays: input.remindBeforeDays };
}
