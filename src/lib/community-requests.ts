import {
  Prisma,
  type CommunityRequestCategory,
  type CommunityRequestPriority,
  type CommunityRequestStatus,
} from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import {
  enqueueNotificationJobWithClient,
  processNotificationJobNow,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

type RequestActor = {
  id: string;
};

type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type CommunityRequestDto = {
  id: string;
  category: CommunityRequestCategory;
  priority: CommunityRequestPriority;
  status: CommunityRequestStatus;
  title: string;
  description: string;
  expiresAt: string;
  createdAt: string;
  helpCount: number;
  isHelping: boolean;
  isMine: boolean;
};

export class CommunityRequestError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "CommunityRequestError";
  }
}

function requestSelectFor(userId: string) {
  return {
    id: true,
    creatorId: true,
    category: true,
    priority: true,
    status: true,
    title: true,
    description: true,
    expiresAt: true,
    createdAt: true,
    helpOffers: {
      where: { userId },
      select: { userId: true },
      take: 1,
    },
    _count: { select: { helpOffers: true } },
  } satisfies Prisma.CommunityRequestSelect;
}

type SelectedRequest = Prisma.CommunityRequestGetPayload<{
  select: ReturnType<typeof requestSelectFor>;
}>;

function requestDto(
  request: SelectedRequest,
  userId: string,
  now: Date,
): CommunityRequestDto {
  const expired =
    request.status !== "CLOSED" && request.expiresAt.getTime() <= now.getTime();
  return {
    id: request.id,
    category: request.category,
    priority: request.priority,
    status: expired ? "CLOSED" : request.status,
    title: request.title,
    description: request.description,
    expiresAt: request.expiresAt.toISOString(),
    createdAt: request.createdAt.toISOString(),
    helpCount: request._count.helpOffers,
    isHelping: request.helpOffers.length > 0,
    isMine: request.creatorId === userId,
  };
}

function sortActiveRequests(requests: CommunityRequestDto[]) {
  const priorityRank: Record<CommunityRequestPriority, number> = {
    URGENT: 0,
    IMPORTANT: 1,
    NORMAL: 2,
  };
  return requests.sort(
    (left, right) =>
      priorityRank[left.priority] - priorityRank[right.priority] ||
      new Date(left.expiresAt).getTime() - new Date(right.expiresAt).getTime(),
  );
}

export async function getCommunityRequestOverview(input: {
  communityId: string;
  userId: string;
  includeLists?: boolean;
}) {
  const now = new Date();
  const select = requestSelectFor(input.userId);
  const activeUrgentWhere: Prisma.CommunityRequestWhereInput = {
    communityId: input.communityId,
    priority: "URGENT",
    status: { in: ["OPEN", "IN_PROGRESS"] },
    expiresAt: { gt: now },
  };
  if (!input.includeLists) {
    const [urgentCount, spotlight] = await Promise.all([
      prisma.communityRequest.count({ where: activeUrgentWhere }),
      prisma.communityRequest.findFirst({
        where: activeUrgentWhere,
        select,
        orderBy: { expiresAt: "asc" },
      }),
    ]);
    return {
      communityRequests: [],
      myRequests: [],
      urgentCount,
      spotlightRequest: spotlight
        ? requestDto(spotlight, input.userId, now)
        : null,
    };
  }
  const [active, mine, urgentCount, spotlight] = await Promise.all([
    prisma.communityRequest.findMany({
      where: {
        communityId: input.communityId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        expiresAt: { gt: now },
      },
      select,
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.communityRequest.findMany({
      where: {
        communityId: input.communityId,
        creatorId: input.userId,
      },
      select,
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.communityRequest.count({ where: activeUrgentWhere }),
    prisma.communityRequest.findFirst({
      where: activeUrgentWhere,
      select,
      orderBy: { expiresAt: "asc" },
    }),
  ]);
  const communityRequests = sortActiveRequests(
    active.map((request) => requestDto(request, input.userId, now)),
  );
  const myRequests = mine.map((request) =>
    requestDto(request, input.userId, now),
  );
  return {
    communityRequests,
    myRequests,
    urgentCount,
    spotlightRequest: spotlight
      ? requestDto(spotlight, input.userId, now)
      : null,
  };
}

export async function createCommunityRequest(input: {
  actor: RequestActor;
  communityId: string;
  data: {
    category: CommunityRequestCategory;
    priority: CommunityRequestPriority;
    title: string;
    description: string;
    expiresAt: Date;
  };
  meta?: RequestMeta;
}) {
  return prisma.$transaction(async (tx) => {
    const membership = await tx.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: input.communityId,
          userId: input.actor.id,
        },
      },
      select: {
        id: true,
        community: { select: { status: true } },
      },
    });
    if (!membership) {
      throw new CommunityRequestError(
        "Join this community before creating a request.",
        403,
      );
    }
    if (membership.community.status !== "ACTIVE") {
      throw new CommunityRequestError(
        "Requests are unavailable in this community.",
        409,
      );
    }

    const request = await tx.communityRequest.create({
      data: {
        communityId: input.communityId,
        creatorId: input.actor.id,
        ...input.data,
      },
      select: {
        id: true,
        status: true,
        priority: true,
        expiresAt: true,
      },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "COMMUNITY_REQUEST_CREATED",
      entityType: "CommunityRequest",
      entityId: request.id,
      newValue: {
        communityId: input.communityId,
        priority: request.priority,
        expiresAt: request.expiresAt,
      },
      ...input.meta,
    });
    return {
      request: {
        ...request,
        expiresAt: request.expiresAt.toISOString(),
      },
    };
  });
}

export async function offerCommunityRequestHelp(input: {
  actor: RequestActor;
  requestId: string;
  meta?: RequestMeta;
}) {
  const now = new Date();
  const outcome = await prisma.$transaction(async (tx) => {
    const request = await tx.communityRequest.findUnique({
      where: { id: input.requestId },
      select: {
        id: true,
        creatorId: true,
        title: true,
        status: true,
        expiresAt: true,
        communityId: true,
        community: { select: { slug: true } },
      },
    });
    if (!request) {
      throw new CommunityRequestError("Request not found.", 404);
    }
    if (request.expiresAt.getTime() <= now.getTime()) {
      await tx.communityRequest.updateMany({
        where: {
          id: request.id,
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
        data: { status: "CLOSED", closedAt: now },
      });
      return { error: "EXPIRED" as const };
    }
    if (request.status === "CLOSED") {
      throw new CommunityRequestError("This request is already closed.", 409);
    }
    if (request.creatorId === input.actor.id) {
      throw new CommunityRequestError(
        "You cannot offer help on your own request.",
        409,
      );
    }
    const membership = await tx.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: request.communityId,
          userId: input.actor.id,
        },
      },
      select: {
        community: { select: { status: true } },
        user: { select: { firstName: true, lastName: true } },
      },
    });
    if (!membership) {
      throw new CommunityRequestError(
        "Join this community before offering help.",
        403,
      );
    }
    if (membership.community.status !== "ACTIVE") {
      throw new CommunityRequestError(
        "Help offers are unavailable in this community.",
        409,
      );
    }

    const created = await tx.communityRequestHelpOffer.createMany({
      data: [{ requestId: request.id, userId: input.actor.id }],
      skipDuplicates: true,
    });
    await tx.communityRequest.updateMany({
      where: { id: request.id, status: "OPEN" },
      data: { status: "IN_PROGRESS" },
    });
    const helpCount = await tx.communityRequestHelpOffer.count({
      where: { requestId: request.id },
    });

    let notificationJobId: string | null = null;
    if (created.count) {
      const helperName =
        `${membership.user.firstName} ${membership.user.lastName}`.trim();
      const job = await enqueueNotificationJobWithClient(tx, {
        recipientId: request.creatorId,
        actorId: input.actor.id,
        type: "COMMUNITY_ANNOUNCEMENT",
        templateKey: "COMMUNITY_REQUEST_HELP",
        data: {
          actorName: helperName,
          requestTitle: request.title,
        },
        href: `/communities/${request.community.slug}?tab=requests#request-${request.id}`,
        dedupeKey: `community-request-help:${request.id}:${input.actor.id}`,
      });
      notificationJobId = job?.id ?? null;
      await writeAuditLogWithClient(tx, {
        actorId: input.actor.id,
        action: "COMMUNITY_REQUEST_HELP_OFFERED",
        entityType: "CommunityRequest",
        entityId: request.id,
        newValue: { helpCount },
        ...input.meta,
      });
    }
    return {
      error: null,
      helpCount,
      status: "IN_PROGRESS" as const,
      notificationJobId,
    };
  });

  if (outcome.error === "EXPIRED") {
    throw new CommunityRequestError("This request has expired.", 409);
  }
  if (outcome.notificationJobId) {
    await processNotificationJobNow(outcome.notificationJobId);
  }
  return {
    helping: true,
    helpCount: outcome.helpCount,
    status: outcome.status,
  };
}

export async function closeCommunityRequest(input: {
  actor: RequestActor;
  requestId: string;
  meta?: RequestMeta;
}) {
  const outcome = await prisma.$transaction(async (tx) => {
    const request = await tx.communityRequest.findUnique({
      where: { id: input.requestId },
      select: {
        id: true,
        creatorId: true,
        title: true,
        status: true,
        community: { select: { slug: true } },
        helpOffers: { select: { userId: true } },
      },
    });
    if (!request) {
      throw new CommunityRequestError("Request not found.", 404);
    }
    if (request.creatorId !== input.actor.id) {
      throw new CommunityRequestError(
        "Only the request creator can close it.",
        403,
      );
    }
    if (request.status === "CLOSED") {
      return {
        status: "CLOSED" as const,
        notificationJobIds: [] as string[],
      };
    }

    const closedAt = new Date();
    await tx.communityRequest.update({
      where: { id: request.id },
      data: { status: "CLOSED", closedAt },
    });
    const notificationJobIds: string[] = [];
    for (const offer of request.helpOffers) {
      const job = await enqueueNotificationJobWithClient(tx, {
        recipientId: offer.userId,
        actorId: input.actor.id,
        type: "COMMUNITY_ANNOUNCEMENT",
        templateKey: "COMMUNITY_REQUEST_CLOSED",
        data: {
          requestTitle: request.title,
        },
        href: `/communities/${request.community.slug}?tab=requests#request-${request.id}`,
        dedupeKey: `community-request-closed:${request.id}:${offer.userId}`,
      });
      if (job) notificationJobIds.push(job.id);
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "COMMUNITY_REQUEST_CLOSED",
      entityType: "CommunityRequest",
      entityId: request.id,
      oldValue: { status: request.status },
      newValue: { status: "CLOSED", closedAt },
      ...input.meta,
    });
    return { status: "CLOSED" as const, notificationJobIds };
  });

  await Promise.allSettled(
    outcome.notificationJobIds.map((jobId) => processNotificationJobNow(jobId)),
  );
  return { status: outcome.status };
}

export async function closeExpiredCommunityRequests(now = new Date()) {
  const result = await prisma.communityRequest.updateMany({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS"] },
      expiresAt: { lte: now },
    },
    data: { status: "CLOSED", closedAt: now },
  });
  return { closed: result.count };
}
