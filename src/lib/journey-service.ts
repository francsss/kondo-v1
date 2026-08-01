import type { KondoJourneyGroup, KondoJourneyStage } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { writeAuditLogWithClient } from "@/lib/audit";
import {
  inferJourney,
  isJourneyStageInGroup,
  legacyJourneyFor,
  prospectiveStageFor,
} from "@/lib/journey";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";

export class JourneyError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "JourneyError";
  }
}

export async function getUserJourney(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      studentJourney: true,
      journeyDetail: {
        select: {
          journeyGroup: true,
          journeyStage: true,
          journeyUpdatedAt: true,
          applicationStage: true,
        },
      },
    },
  });
  if (!user) throw new JourneyError("Account not found.", 404);
  const journey = inferJourney({
    group: user.journeyDetail?.journeyGroup,
    stage: user.journeyDetail?.journeyStage,
    legacyJourney: user.studentJourney,
    applicationStage: user.journeyDetail?.applicationStage,
  });
  return {
    ...journey,
    updatedAt: user.journeyDetail?.journeyUpdatedAt?.toISOString() ?? null,
  };
}

export async function updateUserJourney(input: {
  userId: string;
  group: KondoJourneyGroup;
  stage: KondoJourneyStage;
}) {
  if (!isJourneyStageInGroup(input.group, input.stage)) {
    throw new JourneyError("Choose a stage that belongs to this journey.");
  }
  const now = new Date();
  const nextLegacy = legacyJourneyFor(input.group, input.stage);
  const nextApplicationStage = prospectiveStageFor(input.group, input.stage);
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({
      where: { id: input.userId },
      select: { studentJourney: true, journeyDetail: true },
    });
    if (!current) throw new JourneyError("Account not found.", 404);
    const previous = inferJourney({
      group: current.journeyDetail?.journeyGroup,
      stage: current.journeyDetail?.journeyStage,
      legacyJourney: current.studentJourney,
      applicationStage: current.journeyDetail?.applicationStage,
    });
    await tx.user.update({
      where: { id: input.userId },
      data: { studentJourney: nextLegacy },
    });
    await tx.userJourneyDetail.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        journeyGroup: input.group,
        journeyStage: input.stage,
        journeyUpdatedAt: now,
        applicationStage: nextApplicationStage,
      },
      update: {
        journeyGroup: input.group,
        journeyStage: input.stage,
        journeyUpdatedAt: now,
        applicationStage: nextApplicationStage,
      },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.userId,
      action: "KONDO_JOURNEY_UPDATED",
      entityType: "User",
      entityId: input.userId,
      oldValue: previous,
      newValue: { group: input.group, stage: input.stage },
    });
    return {
      group: input.group,
      stage: input.stage,
      updatedAt: now.toISOString(),
    };
  });
  revalidatePath("/home");
  await captureServerProductEvent({
    distinctId: input.userId,
    event: PRODUCT_EVENTS.JOURNEY_UPDATED,
    properties: { journey_group: input.group, journey_stage: input.stage },
  });
  return result;
}
