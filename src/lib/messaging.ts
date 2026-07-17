import { Prisma, type MediaPurpose } from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import {
  hasAdminPermission,
  type AppRole,
} from "@/lib/authorization";
import {
  attachMediaAsset,
  MediaError,
} from "@/lib/media";
import { enqueueNotificationJobWithClient } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const DUPLICATE_WINDOW_MS = 10_000;
const DEFAULT_INBOX_PAGE_SIZE = 20;
const DEFAULT_MESSAGE_PAGE_SIZE = 50;

const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  type: true,
  body: true,
  attachmentName: true,
  attachmentMime: true,
  attachmentSize: true,
  editedAt: true,
  createdAt: true,
  media: {
    select: {
      id: true,
      kind: true,
      status: true,
      altText: true,
    },
  },
} satisfies Prisma.MessageSelect;

type SelectedMessage = Prisma.MessageGetPayload<{
  select: typeof messageSelect;
}>;

export class MessagingError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "MessagingError";
  }
}

export function directConversationKey(
  firstUserId: string,
  secondUserId: string,
) {
  return [firstUserId, secondUserId].sort().join(":");
}

function safeMessageDto(message: SelectedMessage) {
  const mediaAvailable = message.media?.status === "ACTIVE";
  return {
    id: message.id,
    senderId: message.senderId,
    type: message.type,
    body: message.body,
    attachment: message.media
      ? {
          id: message.media.id,
          kind: message.media.kind,
          name: message.attachmentName,
          mimeType: message.attachmentMime,
          sizeBytes: message.attachmentSize,
          altText: message.media.altText,
          url: mediaAvailable ? `/api/media/${message.media.id}` : null,
          available: mediaAvailable,
        }
      : message.type !== "TEXT"
        ? {
            id: null,
            kind: message.type === "IMAGE" ? "IMAGE" : "DOCUMENT",
            name: message.attachmentName,
            mimeType: message.attachmentMime,
            sizeBytes: message.attachmentSize,
            altText: null,
            url: null,
            available: false,
          }
        : null,
    editedAt: message.editedAt,
    createdAt: message.createdAt,
  };
}

export async function findDirectConversation(
  firstUserId: string,
  secondUserId: string,
) {
  return prisma.conversation.findUnique({
    where: { directKey: directConversationKey(firstUserId, secondUserId) },
    select: { id: true },
  });
}

export async function isBlockedBetween(
  firstUserId: string,
  secondUserId: string,
) {
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: firstUserId, blockedId: secondUserId },
        { blockerId: secondUserId, blockedId: firstUserId },
      ],
    },
    select: { blockerId: true },
  });
  return Boolean(block);
}

async function ensureCanMessage(senderId: string, recipientId: string) {
  if (senderId === recipientId) {
    throw new MessagingError("You cannot message yourself.", 400);
  }

  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true, status: true },
  });
  if (!recipient || recipient.status !== "ACTIVE") {
    throw new MessagingError("This user is not available.", 404);
  }

  if (await isBlockedBetween(senderId, recipientId)) {
    throw new MessagingError(
      "Messaging is unavailable for this conversation.",
      403,
    );
  }
}

async function rejectRecentDuplicate(
  tx: Prisma.TransactionClient,
  conversationId: string,
  senderId: string,
  body?: string,
) {
  if (!body) return;
  const duplicate = await tx.message.findFirst({
    where: {
      conversationId,
      senderId,
      body,
      mediaId: null,
      createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new MessagingError("This message was already sent.", 409);
  }
}

async function prepareMessageMedia(
  tx: Prisma.TransactionClient,
  input: {
    ownerId: string;
    mediaId?: string;
    conversationId: string;
  },
) {
  if (!input.mediaId) return null;
  const media = await tx.mediaAsset.findFirst({
    where: {
      id: input.mediaId,
      ownerId: input.ownerId,
      purpose: { in: ["MESSAGE_IMAGE", "MESSAGE_DOCUMENT"] },
      status: "ACTIVE",
      scanStatus: "CLEAN",
    },
    select: {
      id: true,
      purpose: true,
      kind: true,
      originalFileName: true,
      detectedMime: true,
      sizeBytes: true,
    },
  });
  if (!media) {
    throw new MessagingError(
      "Active validated message media was not found.",
      400,
    );
  }

  try {
    await attachMediaAsset(tx, {
      ownerId: input.ownerId,
      assetId: media.id,
      purpose: media.purpose as MediaPurpose,
      attachmentType: "CONVERSATION",
      attachmentId: input.conversationId,
    });
  } catch (error) {
    if (error instanceof MediaError) {
      throw new MessagingError(error.message, error.status);
    }
    throw error;
  }

  return {
    mediaId: media.id,
    type: media.kind === "IMAGE" ? ("IMAGE" as const) : ("DOCUMENT" as const),
    attachmentName: media.originalFileName,
    attachmentMime: media.detectedMime,
    attachmentSize: media.sizeBytes,
  };
}

function messagePreview(body: string | undefined, mediaName?: string | null) {
  return body?.slice(0, 280) || (mediaName ? `Attachment: ${mediaName}` : "Attachment");
}

async function persistMessage(
  tx: Prisma.TransactionClient,
  input: {
    conversationId: string;
    senderId: string;
    recipientId: string;
    body?: string;
    mediaId?: string;
    senderName: string;
    notificationType?: "MESSAGE" | "MARKETPLACE_UPDATE";
    templateKey?: "MESSAGE_NEW" | "MARKETPLACE_CONTACT";
    notificationData?: Record<string, string>;
  },
) {
  await rejectRecentDuplicate(
    tx,
    input.conversationId,
    input.senderId,
    input.body,
  );
  const media = await prepareMessageMedia(tx, {
    ownerId: input.senderId,
    mediaId: input.mediaId,
    conversationId: input.conversationId,
  });
  const message = await tx.message.create({
    data: {
      conversationId: input.conversationId,
      senderId: input.senderId,
      body: input.body ?? null,
      ...(media ?? {}),
    },
    select: messageSelect,
  });
  await tx.conversation.update({
    where: { id: input.conversationId },
    data: { lastMessageAt: message.createdAt },
  });
  await Promise.all([
    tx.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId: input.conversationId,
          userId: input.senderId,
        },
      },
      data: {
        lastReadAt: message.createdAt,
        archivedAt: null,
        deletedAt: null,
      },
    }),
    tx.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId: input.conversationId,
          userId: input.recipientId,
        },
      },
      data: { archivedAt: null, deletedAt: null },
    }),
  ]);
  await enqueueNotificationJobWithClient(tx, {
    recipientId: input.recipientId,
    actorId: input.senderId,
    type: input.notificationType ?? "MESSAGE",
    templateKey: input.templateKey ?? "MESSAGE_NEW",
    data:
      input.notificationData ?? {
        actorName: input.senderName,
        preview: messagePreview(input.body, media?.attachmentName),
      },
    href: `/messages/${input.conversationId}`,
    dedupeKey: `message:${message.id}`,
  });

  return {
    conversationId: input.conversationId,
    message: safeMessageDto(message),
  };
}

export async function createDirectMessage(input: {
  senderId: string;
  recipientId: string;
  body?: string;
  mediaId?: string;
  sourceType?: "MARKETPLACE_LISTING";
  sourceId?: string;
}) {
  await ensureCanMessage(input.senderId, input.recipientId);
  const [sender, listing] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.senderId },
      select: { firstName: true, lastName: true },
    }),
    input.sourceType === "MARKETPLACE_LISTING" && input.sourceId
      ? prisma.marketplaceListing.findFirst({
          where: {
            id: input.sourceId,
            sellerId: input.recipientId,
            status: "ACTIVE",
            expiresAt: { gt: new Date() },
            category: { isActive: true },
          },
          select: { id: true, title: true },
        })
      : null,
  ]);
  if (!sender) throw new MessagingError("Sender not found.", 404);
  if (input.sourceType === "MARKETPLACE_LISTING" && !listing) {
    throw new MessagingError("Marketplace listing not found.", 404);
  }

  const directKey = directConversationKey(input.senderId, input.recipientId);
  const now = new Date();
  try {
    return await prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.upsert({
        where: { directKey },
        create: {
          directKey,
          participants: {
            create: [
              { userId: input.senderId, lastReadAt: now },
              { userId: input.recipientId },
            ],
          },
        },
        update: {},
        select: { id: true },
      });

      return persistMessage(tx, {
        conversationId: conversation.id,
        senderId: input.senderId,
        recipientId: input.recipientId,
        body: input.body,
        mediaId: input.mediaId,
        senderName: `${sender.firstName} ${sender.lastName}`,
        notificationType: listing ? "MARKETPLACE_UPDATE" : "MESSAGE",
        templateKey: listing ? "MARKETPLACE_CONTACT" : "MESSAGE_NEW",
        notificationData: listing
          ? {
              actorName: `${sender.firstName} ${sender.lastName}`,
              listingTitle: listing.title,
            }
          : undefined,
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new MessagingError("This attachment was already sent.", 409);
    }
    throw error;
  }
}

export async function replyToConversation(input: {
  conversationId: string;
  senderId: string;
  body?: string;
  mediaId?: string;
}) {
  const membership = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId: input.conversationId,
        userId: input.senderId,
      },
    },
    include: {
      conversation: {
        include: {
          participants: { select: { userId: true } },
        },
      },
    },
  });
  if (!membership) {
    throw new MessagingError("Conversation not found.", 404);
  }
  if (
    membership.conversation.type !== "DIRECT" ||
    membership.conversation.participants.length !== 2
  ) {
    throw new MessagingError("Conversation is unavailable.", 409);
  }

  const recipientId = membership.conversation.participants.find(
    (participant) => participant.userId !== input.senderId,
  )?.userId;
  if (!recipientId) {
    throw new MessagingError("Conversation recipient not found.", 409);
  }
  await ensureCanMessage(input.senderId, recipientId);
  const sender = await prisma.user.findUnique({
    where: { id: input.senderId },
    select: { firstName: true, lastName: true },
  });
  if (!sender) throw new MessagingError("Sender not found.", 404);

  try {
    return await prisma.$transaction((tx) =>
      persistMessage(tx, {
        conversationId: input.conversationId,
        senderId: input.senderId,
        recipientId,
        body: input.body,
        mediaId: input.mediaId,
        senderName: `${sender.firstName} ${sender.lastName}`,
      }),
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new MessagingError("This attachment was already sent.", 409);
    }
    throw error;
  }
}

export async function getInbox(
  userId: string,
  input: {
    page?: number;
    pageSize?: number;
    archived?: boolean;
    query?: string;
  } = {},
) {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(
    50,
    Math.max(1, Math.floor(input.pageSize ?? DEFAULT_INBOX_PAGE_SIZE)),
  );
  const query = input.query?.trim();
  const where: Prisma.ConversationParticipantWhereInput = {
    userId,
    deletedAt: null,
    archivedAt: input.archived ? { not: null } : null,
    conversation: query
      ? {
          OR: [
            {
              participants: {
                some: {
                  userId: { not: userId },
                  user: {
                    OR: [
                      { firstName: { contains: query, mode: "insensitive" } },
                      { lastName: { contains: query, mode: "insensitive" } },
                      { username: { contains: query, mode: "insensitive" } },
                    ],
                  },
                },
              },
            },
            {
              messages: {
                some: { body: { contains: query, mode: "insensitive" } },
              },
            },
          ],
        }
      : undefined,
  };
  const [total, memberships] = await Promise.all([
    prisma.conversationParticipant.count({ where }),
    prisma.conversationParticipant.findMany({
      where,
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    username: true,
                    avatarKey: true,
                  },
                },
              },
            },
            messages: {
              select: messageSelect,
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 1,
            },
          },
        },
      },
      orderBy: [
        { conversation: { lastMessageAt: "desc" } },
        { conversationId: "desc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const conversationIds = memberships.map(({ conversationId }) => conversationId);
  const unreadRows =
    conversationIds.length === 0
      ? []
      : await prisma.$queryRaw<Array<{ conversationId: string; count: bigint }>>(
          Prisma.sql`
            SELECT
              cp."conversationId" AS "conversationId",
              COUNT(m."id")::bigint AS "count"
            FROM "ConversationParticipant" cp
            JOIN "Message" m ON m."conversationId" = cp."conversationId"
            WHERE cp."userId" = ${userId}
              AND cp."conversationId" IN (${Prisma.join(conversationIds)})
              AND m."senderId" <> ${userId}
              AND (cp."lastReadAt" IS NULL OR m."createdAt" > cp."lastReadAt")
              AND (cp."clearedAt" IS NULL OR m."createdAt" > cp."clearedAt")
            GROUP BY cp."conversationId"
          `,
        );
  const unreadByConversation = new Map(
    unreadRows.map((row) => [row.conversationId, Number(row.count)]),
  );

  return {
    conversations: memberships.map((membership) => ({
      conversationId: membership.conversationId,
      archivedAt: membership.archivedAt,
      unreadCount: unreadByConversation.get(membership.conversationId) ?? 0,
      otherParticipant: membership.conversation.participants.find(
        (participant) => participant.userId !== userId,
      )?.user,
      latestMessage: membership.conversation.messages[0]
        ? safeMessageDto(membership.conversation.messages[0])
        : null,
    })),
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
    archived: Boolean(input.archived),
    query: query ?? "",
  };
}

export async function getUnreadMessageCount(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(m."id")::bigint AS "count"
    FROM "ConversationParticipant" cp
    JOIN "Message" m ON m."conversationId" = cp."conversationId"
    WHERE cp."userId" = ${userId}
      AND m."senderId" <> ${userId}
      AND (cp."lastReadAt" IS NULL OR m."createdAt" > cp."lastReadAt")
      AND (cp."clearedAt" IS NULL OR m."createdAt" > cp."clearedAt")
  `;
  return Number(rows[0]?.count ?? 0n);
}

export async function getConversationForUser(
  conversationId: string,
  userId: string,
  input: { page?: number; pageSize?: number } = {},
) {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(
    100,
    Math.max(1, Math.floor(input.pageSize ?? DEFAULT_MESSAGE_PAGE_SIZE)),
  );
  const membership = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  username: true,
                  avatarKey: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (
    !membership ||
    membership.conversation.type !== "DIRECT" ||
    membership.conversation.participants.length !== 2
  ) {
    return null;
  }

  const messageWhere: Prisma.MessageWhereInput = {
    conversationId,
    createdAt: membership.clearedAt
      ? { gt: membership.clearedAt }
      : undefined,
  };
  const [total, messages] = await Promise.all([
    prisma.message.count({ where: messageWhere }),
    prisma.message.findMany({
      where: messageWhere,
      select: {
        ...messageSelect,
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarKey: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    conversationId,
    archivedAt: membership.archivedAt,
    deletedAt: membership.deletedAt,
    messages: messages.reverse().map((message) => ({
      ...safeMessageDto(message),
      sender: message.sender,
    })),
    otherParticipant: membership.conversation.participants.find(
      (participant) => participant.userId !== userId,
    )?.user,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
  };
}

export async function markConversationRead(input: {
  conversationId: string;
  userId: string;
  latestMessageId: string;
}) {
  const message = await prisma.message.findFirst({
    where: {
      id: input.latestMessageId,
      conversationId: input.conversationId,
    },
    select: { createdAt: true },
  });
  if (!message) throw new MessagingError("Conversation not found.", 404);

  const result = await prisma.conversationParticipant.updateMany({
    where: {
      conversationId: input.conversationId,
      userId: input.userId,
      OR: [{ lastReadAt: null }, { lastReadAt: { lt: message.createdAt } }],
      AND: [
        {
          OR: [{ clearedAt: null }, { clearedAt: { lt: message.createdAt } }],
        },
      ],
    },
    data: { lastReadAt: message.createdAt },
  });
  if (result.count === 0) {
    const membership = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: input.conversationId,
          userId: input.userId,
        },
      },
      select: { conversationId: true },
    });
    if (!membership) throw new MessagingError("Conversation not found.", 404);
  }
  return { success: true };
}

export async function setConversationArchived(input: {
  conversationId: string;
  userId: string;
  archived: boolean;
}) {
  const result = await prisma.conversationParticipant.updateMany({
    where: {
      conversationId: input.conversationId,
      userId: input.userId,
      deletedAt: null,
    },
    data: { archivedAt: input.archived ? new Date() : null },
  });
  if (result.count === 0) {
    throw new MessagingError("Conversation not found.", 404);
  }
  return { archived: input.archived };
}

export async function clearConversationForUser(input: {
  conversationId: string;
  userId: string;
  metadata?: { ipAddress?: string | null; userAgent?: string | null };
}) {
  return prisma.$transaction(async (tx) => {
    const membership = await tx.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: input.conversationId,
          userId: input.userId,
        },
      },
      select: { conversationId: true },
    });
    if (!membership) {
      throw new MessagingError("Conversation not found.", 404);
    }
    const now = new Date();
    await tx.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId: input.conversationId,
          userId: input.userId,
        },
      },
      data: {
        clearedAt: now,
        deletedAt: now,
        archivedAt: now,
        lastReadAt: now,
      },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.userId,
      action: "CONVERSATION_CLEARED_FOR_USER",
      entityType: "Conversation",
      entityId: input.conversationId,
      newValue: { participantHistoryHiddenAt: now },
      ...input.metadata,
    });
    return { cleared: true };
  });
}

export async function getMessageSafetyOverview(actor: {
  id: string;
  role: AppRole | string;
}) {
  if (!hasAdminPermission(actor.role, "MESSAGE_SAFETY_VIEW")) {
    throw new MessagingError("Access denied.", 403);
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [
    directConversations,
    messages24h,
    attachmentMessages,
    activeBlocks,
    openReports,
    archivedMemberships,
    clearedMemberships,
    recentReports,
  ] = await Promise.all([
    prisma.conversation.count({ where: { type: "DIRECT" } }),
    prisma.message.count({ where: { createdAt: { gte: since } } }),
    prisma.message.count({ where: { mediaId: { not: null } } }),
    prisma.userBlock.count(),
    prisma.report.count({
      where: {
        targetType: "Conversation",
        status: { in: ["OPEN", "REVIEWING"] },
      },
    }),
    prisma.conversationParticipant.count({
      where: { archivedAt: { not: null }, deletedAt: null },
    }),
    prisma.conversationParticipant.count({
      where: { deletedAt: { not: null } },
    }),
    prisma.report.findMany({
      where: { targetType: "Conversation" },
      select: {
        id: true,
        status: true,
        reason: true,
        createdAt: true,
        assignee: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    metrics: {
      directConversations,
      messages24h,
      attachmentMessages,
      activeBlocks,
      openReports,
      archivedMemberships,
      clearedMemberships,
    },
    recentReports: recentReports.map((report) => ({
      id: report.id,
      status: report.status,
      reason: report.reason,
      createdAt: report.createdAt,
      assigneeName: report.assignee
        ? `${report.assignee.firstName} ${report.assignee.lastName}`
        : null,
    })),
    privacy: {
      rawConversationAccess: false,
      evidenceAccess: "Report-bound and permission-redacted only",
    },
  };
}
