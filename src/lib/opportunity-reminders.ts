import { enqueueNotificationJobWithClient } from "@/lib/notifications";
import { publicOpportunityWhere } from "@/lib/opportunity-visibility";
import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_REMINDER_DAYS = 14;

export function reminderIsDue(input: {
  deadline: Date;
  days: number;
  now: Date;
  lastRemindedAt?: Date | null;
}) {
  const target = new Date(input.deadline.getTime() - input.days * DAY_MS);
  return (
    input.deadline > input.now &&
    target <= input.now &&
    (!input.lastRemindedAt || input.lastRemindedAt < target)
  );
}

export async function processOpportunityReminders(now = new Date()) {
  const horizon = new Date(now.getTime() + MAX_REMINDER_DAYS * DAY_MS);
  const [saved, applications] = await Promise.all([
    prisma.opportunitySaved.findMany({
      where: {
        remindBeforeDays: { not: null },
        opportunity: {
          ...publicOpportunityWhere({ now }),
          applicationDeadline: { gt: now, lte: horizon },
        },
      },
      select: {
        userId: true,
        opportunityId: true,
        remindBeforeDays: true,
        lastRemindedAt: true,
        opportunity: {
          select: { title: true, slug: true, applicationDeadline: true },
        },
      },
      take: 500,
    }),
    prisma.opportunityApplication.findMany({
      where: {
        status: {
          in: ["DRAFT", "MORE_INFORMATION_REQUIRED"],
        },
        opportunity: {
          ...publicOpportunityWhere({ now }),
          applicationDeadline: { gt: now, lte: horizon },
        },
        applicantUser: {
          opportunityProfile: {
            deadlineReminderDays: { isEmpty: false },
          },
        },
      },
      select: {
        id: true,
        applicantUserId: true,
        opportunity: {
          select: { title: true, applicationDeadline: true },
        },
        applicantUser: {
          select: {
            opportunityProfile: { select: { deadlineReminderDays: true } },
          },
        },
      },
      take: 500,
    }),
  ]);

  let queued = 0;
  for (const item of saved) {
    const days = item.remindBeforeDays;
    const deadline = item.opportunity.applicationDeadline;
    if (
      days === null ||
      !deadline ||
      !reminderIsDue({
        deadline,
        days,
        now,
        lastRemindedAt: item.lastRemindedAt,
      })
    ) {
      continue;
    }
    await prisma.$transaction(async (tx) => {
      const stillSaved = await tx.opportunitySaved.findUnique({
        where: {
          userId_opportunityId: {
            userId: item.userId,
            opportunityId: item.opportunityId,
          },
        },
        select: { remindBeforeDays: true, lastRemindedAt: true },
      });
      if (
        stillSaved?.remindBeforeDays !== days ||
        !reminderIsDue({
          deadline,
          days,
          now,
          lastRemindedAt: stillSaved.lastRemindedAt,
        })
      ) {
        return;
      }
      await enqueueNotificationJobWithClient(tx, {
        recipientId: item.userId,
        type: "OPPORTUNITY",
        templateKey: "OPPORTUNITY_DEADLINE_REMINDER",
        data: { opportunityTitle: item.opportunity.title, days },
        href: `/opportunities/${item.opportunity.slug}`,
        dedupeKey: `opportunity-deadline:${item.opportunityId}:${deadline.toISOString()}:${days}`,
      });
      await tx.opportunitySaved.update({
        where: {
          userId_opportunityId: {
            userId: item.userId,
            opportunityId: item.opportunityId,
          },
        },
        data: { lastRemindedAt: now },
      });
      queued += 1;
    });
  }

  for (const application of applications) {
    const deadline = application.opportunity.applicationDeadline;
    if (!deadline) continue;
    const daysList =
      application.applicantUser.opportunityProfile?.deadlineReminderDays ?? [];
    for (const days of daysList) {
      if (!reminderIsDue({ deadline, days, now })) continue;
      await prisma.$transaction(async (tx) => {
        const active = await tx.opportunityApplication.findFirst({
          where: {
            id: application.id,
            applicantUserId: application.applicantUserId,
            status: {
              in: ["DRAFT", "MORE_INFORMATION_REQUIRED"],
            },
          },
          select: { id: true },
        });
        if (!active) return;
        await enqueueNotificationJobWithClient(tx, {
          recipientId: application.applicantUserId,
          type: "OPPORTUNITY",
          templateKey: "OPPORTUNITY_DEADLINE_REMINDER",
          data: { opportunityTitle: application.opportunity.title, days },
          href: `/opportunities/applications/${application.id}`,
          dedupeKey: `opportunity-application-deadline:${application.id}:${deadline.toISOString()}:${days}`,
        });
        queued += 1;
      });
    }
  }
  return {
    queued,
    savedCandidates: saved.length,
    applicationCandidates: applications.length,
  };
}
