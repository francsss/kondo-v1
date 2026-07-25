import {
  Prisma,
  type PetFeedbackCategory,
  type PetFeedbackStatus,
} from "@prisma/client";
import { hasAdminPermission, type AppRole } from "@/lib/authorization";
import { writeAuditLogWithClient } from "@/lib/audit";
import { productAreaForPath } from "@/lib/product-analytics-events";
import { prisma } from "@/lib/prisma";
import type {
  petFeedbackNoteSchema,
  petFeedbackStatusSchema,
  petFeedbackSubmissionSchema,
} from "@/lib/pet-feedback-validation";
import type { z } from "zod";

type Actor = { id: string; role: AppRole | string };
type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};
type Submission = z.infer<typeof petFeedbackSubmissionSchema>;
type StatusUpdate = z.infer<typeof petFeedbackStatusSchema>;
type NoteInput = z.infer<typeof petFeedbackNoteSchema>;

export class PetFeedbackError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "PetFeedbackError";
  }
}

function requireFeedbackPermission(actor: Actor, manage = false) {
  const permission = manage ? "FEEDBACK_MANAGE" : "FEEDBACK_VIEW";
  if (!hasAdminPermission(actor.role, permission)) {
    throw new PetFeedbackError("Access denied.", 403);
  }
}

export async function createPetFeedback(
  actor: { id: string },
  input: Submission,
  metadata: RequestMeta = {},
) {
  return prisma.$transaction(async (transaction) => {
    const feedback = await transaction.petFeedback.create({
      data: {
        userId: actor.id,
        category: input.category,
        message: input.message,
        pagePath: input.pagePath,
        pageArea: productAreaForPath(input.pagePath),
        submittedAfterMs: input.submittedAfterMs,
      },
      select: {
        id: true,
        category: true,
        status: true,
        createdAt: true,
      },
    });
    await writeAuditLogWithClient(transaction, {
      actorId: actor.id,
      action: "PET_FEEDBACK_SUBMITTED",
      entityType: "PET_FEEDBACK",
      entityId: feedback.id,
      newValue: {
        category: feedback.category,
        pagePath: input.pagePath,
        pageArea: productAreaForPath(input.pagePath),
      },
      ...metadata,
    });
    return feedback;
  });
}

type FeedbackFilters = {
  page?: number;
  query?: string;
  status?: PetFeedbackStatus;
  category?: PetFeedbackCategory;
  pageArea?: string;
};

function feedbackWhere(input: FeedbackFilters): Prisma.PetFeedbackWhereInput {
  const query = input.query?.trim();
  return {
    ...(input.status ? { status: input.status } : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(input.pageArea ? { pageArea: input.pageArea } : {}),
    ...(query
      ? {
          OR: [
            { id: { contains: query, mode: "insensitive" } },
            { message: { contains: query, mode: "insensitive" } },
            { pagePath: { contains: query, mode: "insensitive" } },
            {
              user: {
                is: {
                  OR: [
                    { firstName: { contains: query, mode: "insensitive" } },
                    { lastName: { contains: query, mode: "insensitive" } },
                    { email: { contains: query, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };
}

export async function listPetFeedback(
  actor: Actor,
  input: FeedbackFilters = {},
) {
  requireFeedbackPermission(actor);
  const pageSize = 20;
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const where = feedbackWhere(input);
  const [total, feedback] = await Promise.all([
    prisma.petFeedback.count({ where }),
    prisma.petFeedback.findMany({
      where,
      select: {
        id: true,
        category: true,
        message: true,
        pagePath: true,
        pageArea: true,
        submittedAfterMs: true,
        status: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: { select: { notes: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    feedback,
    page,
    pageSize,
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getPetFeedbackSummary(actor: Actor) {
  requireFeedbackPermission(actor);
  const [byStatus, averageSubmission] = await Promise.all([
    prisma.petFeedback.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.petFeedback.aggregate({
      where: { submittedAfterMs: { not: null } },
      _avg: { submittedAfterMs: true },
    }),
  ]);
  return {
    counts: Object.fromEntries(
      byStatus.map((item) => [item.status, item._count]),
    ) as Partial<Record<PetFeedbackStatus, number>>,
    averageSubmissionMs: averageSubmission._avg.submittedAfterMs,
  };
}

export async function getPetFeedback(actor: Actor, feedbackId: string) {
  requireFeedbackPermission(actor);
  return prisma.petFeedback.findUnique({
    where: { id: feedbackId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          username: true,
        },
      },
      resolvedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
      notes: {
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function updatePetFeedbackStatus(
  actor: Actor,
  feedbackId: string,
  input: StatusUpdate,
  metadata: RequestMeta = {},
) {
  requireFeedbackPermission(actor, true);
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.petFeedback.findUnique({
      where: { id: feedbackId },
      select: { id: true, status: true, version: true, resolvedAt: true },
    });
    if (!current) throw new PetFeedbackError("Feedback was not found.", 404);
    if (current.version !== input.expectedVersion) {
      throw new PetFeedbackError(
        "This feedback changed while you were reviewing it. Refresh and try again.",
        409,
      );
    }
    if (current.status === input.status) return current;

    const resolved = input.status === "RESOLVED";
    const update = await transaction.petFeedback.updateMany({
      where: { id: feedbackId, version: input.expectedVersion },
      data: {
        status: input.status,
        version: { increment: 1 },
        resolvedAt: resolved ? new Date() : null,
        resolvedById: resolved ? actor.id : null,
      },
    });
    if (update.count !== 1) {
      throw new PetFeedbackError(
        "This feedback changed while you were reviewing it. Refresh and try again.",
        409,
      );
    }
    const feedback = await transaction.petFeedback.findUniqueOrThrow({
      where: { id: feedbackId },
      select: {
        id: true,
        status: true,
        version: true,
        resolvedAt: true,
      },
    });
    await writeAuditLogWithClient(transaction, {
      actorId: actor.id,
      action: "PET_FEEDBACK_STATUS_UPDATED",
      entityType: "PET_FEEDBACK",
      entityId: feedbackId,
      oldValue: { status: current.status, version: current.version },
      newValue: { status: feedback.status, version: feedback.version },
      ...metadata,
    });
    return feedback;
  });
}

export async function addPetFeedbackNote(
  actor: Actor,
  feedbackId: string,
  input: NoteInput,
  metadata: RequestMeta = {},
) {
  requireFeedbackPermission(actor, true);
  return prisma.$transaction(async (transaction) => {
    const exists = await transaction.petFeedback.findUnique({
      where: { id: feedbackId },
      select: { id: true },
    });
    if (!exists) throw new PetFeedbackError("Feedback was not found.", 404);
    const note = await transaction.petFeedbackNote.create({
      data: {
        feedbackId,
        authorId: actor.id,
        body: input.body,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    await writeAuditLogWithClient(transaction, {
      actorId: actor.id,
      action: "PET_FEEDBACK_NOTE_ADDED",
      entityType: "PET_FEEDBACK",
      entityId: feedbackId,
      newValue: { noteId: note.id },
      ...metadata,
    });
    return note;
  });
}

function csvCell(value: unknown) {
  let content =
    value instanceof Date
      ? value.toISOString()
      : value === null || value === undefined
        ? ""
        : String(value);
  if (/^[=+\-@]/.test(content)) content = `'${content}`;
  return `"${content.replaceAll('"', '""')}"`;
}

export async function exportPetFeedbackCsv(
  actor: Actor,
  input: Omit<FeedbackFilters, "page"> = {},
) {
  requireFeedbackPermission(actor);
  const feedback = await prisma.petFeedback.findMany({
    where: feedbackWhere(input),
    include: {
      user: {
        select: { email: true, firstName: true, lastName: true },
      },
      notes: {
        select: { body: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10_000,
  });
  const rows = [
    [
      "id",
      "created_at",
      "status",
      "category",
      "page_area",
      "page_path",
      "submission_seconds",
      "member_name",
      "member_email",
      "feedback",
      "internal_notes",
    ],
    ...feedback.map((item) => [
      item.id,
      item.createdAt,
      item.status,
      item.category,
      item.pageArea,
      item.pagePath,
      item.submittedAfterMs === null
        ? ""
        : Math.round(item.submittedAfterMs / 1000),
      item.user
        ? `${item.user.firstName} ${item.user.lastName}`.trim()
        : "Deleted member",
      item.user?.email ?? "",
      item.message,
      item.notes
        .map((note) => `${note.createdAt.toISOString()}: ${note.body}`)
        .join(" | "),
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}
