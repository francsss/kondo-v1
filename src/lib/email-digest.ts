import type { NotificationDigest } from "@prisma/client";
import { sendTransactionalEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const DIGEST_INTERVAL_MS: Record<
  Exclude<NotificationDigest, "NEVER">,
  number
> = {
  DAILY: 24 * 60 * 60_000,
  WEEKLY: 7 * 24 * 60 * 60_000,
};

function appUrl() {
  return getAppUrl();
}

/**
 * Sends a due digest email to every member whose emailDigest preference is
 * DAILY or WEEKLY and whose interval has elapsed since lastDigestSentAt.
 * Members with zero unread notifications are skipped without being marked
 * sent, so they remain eligible as soon as they have something to report.
 */
export async function sendDueEmailDigests(now = new Date()) {
  const dueDaily = new Date(now.getTime() - DIGEST_INTERVAL_MS.DAILY);
  const dueWeekly = new Date(now.getTime() - DIGEST_INTERVAL_MS.WEEKLY);

  const candidates = await prisma.userPreference.findMany({
    where: {
      OR: [
        {
          emailDigest: "DAILY",
          OR: [
            { lastDigestSentAt: null },
            { lastDigestSentAt: { lte: dueDaily } },
          ],
        },
        {
          emailDigest: "WEEKLY",
          OR: [
            { lastDigestSentAt: null },
            { lastDigestSentAt: { lte: dueWeekly } },
          ],
        },
      ],
    },
    select: {
      userId: true,
      emailDigest: true,
      user: { select: { email: true, firstName: true, status: true } },
    },
    take: 500,
  });

  let examined = 0;
  let sent = 0;
  let skippedEmpty = 0;

  for (const candidate of candidates) {
    examined += 1;
    if (candidate.user.status !== "ACTIVE") continue;
    const unread = await getUnreadNotificationCount(candidate.userId);
    if (unread === 0) {
      skippedEmpty += 1;
      continue;
    }
    await sendTransactionalEmail({
      to: candidate.user.email,
      subject: `${unread} unread update${unread === 1 ? "" : "s"} on Kondo`,
      text: `Hi ${candidate.user.firstName},\n\nYou have ${unread} unread notification${unread === 1 ? "" : "s"} waiting on Kondo.\n\n${appUrl()}/notifications\n\nManage your digest frequency any time in Settings → Notifications.`,
    });
    await prisma.userPreference.update({
      where: { userId: candidate.userId },
      data: { lastDigestSentAt: now },
    });
    sent += 1;
  }

  return { examined, sent, skippedEmpty };
}
