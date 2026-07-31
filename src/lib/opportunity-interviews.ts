import type {
  OpportunityInterviewFormat,
  OpportunityInterviewStatus,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { OpportunityError } from "@/lib/opportunities";
import { assertApplicationTransition } from "@/lib/opportunity-application-status";
import {
  notifyApplicantResponseWithClient,
  notifyInterviewInvitationWithClient,
} from "@/lib/opportunity-notifications";
import { requireApplicationReviewer } from "@/lib/opportunity-permissions";
import { prisma } from "@/lib/prisma";

export function serializeOpportunityInterview(interview: {
  id: string;
  format: OpportunityInterviewFormat;
  scheduledAt: Date;
  timezone: string;
  locationLabel: string | null;
  meetingUrl: string | null;
  preparationNote: string | null;
  status: OpportunityInterviewStatus;
  applicantRespondedAt: Date | null;
}) {
  return {
    ...interview,
    scheduledAt: interview.scheduledAt.toISOString(),
    applicantRespondedAt: interview.applicantRespondedAt?.toISOString() ?? null,
  };
}

export async function scheduleOpportunityInterview(input: {
  userId: string;
  organizationId: string;
  applicationId: string;
  format: OpportunityInterviewFormat;
  scheduledAt: Date;
  timezone: string;
  locationLabel?: string | null;
  meetingUrl?: string | null;
  preparationNote?: string | null;
}) {
  await requireApplicationReviewer({
    userId: input.userId,
    organizationId: input.organizationId,
    permission: "ORGANIZATION_CHANGE_APPLICATION_STATUS",
  });
  if (input.scheduledAt.getTime() <= Date.now() + 5 * 60_000) {
    throw new OpportunityError(
      "Choose an interview time at least five minutes from now.",
      400,
    );
  }
  const result = await prisma.$transaction(async (tx) => {
    const application = await tx.opportunityApplication.findFirst({
      where: {
        id: input.applicationId,
        organizationId: input.organizationId,
        status: { not: "DRAFT" },
      },
      select: {
        id: true,
        status: true,
        applicantUserId: true,
        opportunity: { select: { title: true } },
      },
    });
    if (!application) {
      throw new OpportunityError("Application not found.", 404);
    }
    if (application.status !== "INTERVIEW") {
      assertApplicationTransition({
        actor: "REVIEWER",
        from: application.status,
        to: "INTERVIEW",
      });
      await tx.opportunityApplication.update({
        where: { id: application.id },
        data: { status: "INTERVIEW" },
      });
      await tx.opportunityApplicationStatusHistory.create({
        data: {
          applicationId: application.id,
          fromStatus: application.status,
          toStatus: "INTERVIEW",
          actingUserId: input.userId,
          applicantVisibleNote: "You received an interview invitation.",
        },
      });
    }
    const interview = await tx.opportunityInterview.create({
      data: {
        applicationId: application.id,
        format: input.format,
        scheduledAt: input.scheduledAt,
        timezone: input.timezone,
        locationLabel: input.locationLabel?.trim() || null,
        meetingUrl: input.meetingUrl?.trim() || null,
        preparationNote: input.preparationNote?.trim() || null,
        createdByUserId: input.userId,
      },
    });
    await notifyInterviewInvitationWithClient(tx, {
      interviewId: interview.id,
      applicationId: application.id,
      applicantUserId: application.applicantUserId,
      actorId: input.userId,
      opportunityTitle: application.opportunity.title,
    });
    return interview;
  });
  await writeAuditLog({
    actorId: input.userId,
    organizationId: input.organizationId,
    action: "OPPORTUNITY_INTERVIEW_SCHEDULED",
    entityType: "OpportunityApplication",
    entityId: input.applicationId,
    newValue: {
      interviewId: result.id,
      format: result.format,
      scheduledAt: result.scheduledAt.toISOString(),
      timezone: result.timezone,
    },
  });
  return serializeOpportunityInterview(result);
}

export async function respondToOpportunityInterview(input: {
  userId: string;
  applicationId: string;
  interviewId: string;
  response: "ACCEPTED" | "DECLINED";
}) {
  const result = await prisma.$transaction(async (tx) => {
    const interview = await tx.opportunityInterview.findFirst({
      where: {
        id: input.interviewId,
        applicationId: input.applicationId,
        application: { applicantUserId: input.userId },
        status: "PROPOSED",
      },
      select: {
        id: true,
        applicationId: true,
        application: {
          select: {
            organizationId: true,
            opportunity: {
              select: {
                title: true,
                publisherOrganization: { select: { slug: true } },
              },
            },
          },
        },
      },
    });
    if (!interview) {
      throw new OpportunityError("Interview invitation not found.", 404);
    }
    const updated = await tx.opportunityInterview.update({
      where: { id: interview.id },
      data: {
        status: input.response,
        applicantRespondedAt: new Date(),
      },
    });
    const organizationId = interview.application.organizationId;
    const organizationSlug =
      interview.application.opportunity.publisherOrganization?.slug;
    if (organizationId && organizationSlug) {
      await notifyApplicantResponseWithClient(tx, {
        applicationId: interview.applicationId,
        organizationId,
        organizationSlug,
        applicantUserId: input.userId,
        opportunityTitle: interview.application.opportunity.title,
        responseKey: interview.id,
      });
    }
    return updated;
  });
  await writeAuditLog({
    actorId: input.userId,
    action: `OPPORTUNITY_INTERVIEW_${input.response}`,
    entityType: "OpportunityApplication",
    entityId: input.applicationId,
  });
  return serializeOpportunityInterview(result);
}
