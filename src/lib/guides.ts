import {
  Prisma,
  type GuideCategory,
  type GuideContentStatus,
} from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { hasAdminPermission, type AppRole } from "@/lib/authorization";
import { attachMediaAsset, MediaError } from "@/lib/media";
import { prisma } from "@/lib/prisma";

type Actor = { id: string; role: AppRole | string };
type RequestMeta = { ipAddress?: string | null; userAgent?: string | null };

export class GuideError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "GuideError";
  }
}

function slugBase(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

async function uniqueGuideSlug(title: string) {
  const base = slugBase(title) || "guide";
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const slug =
      attempt === 0 ? base : `${base}-${crypto.randomUUID().slice(0, 8)}`;
    const existing = await prisma.guide.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
  }
  throw new GuideError("Could not create a unique guide URL.", 409);
}

async function attachGuideCover(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    guideId: string;
    mediaId: string;
    previousMediaId?: string | null;
  },
) {
  try {
    await attachMediaAsset(tx, {
      ownerId: input.actorId,
      assetId: input.mediaId,
      purpose: "GUIDE_COVER",
      attachmentType: "GUIDE",
      attachmentId: input.guideId,
    });
  } catch (error) {
    if (error instanceof MediaError) {
      throw new GuideError(error.message, error.status);
    }
    throw error;
  }
  await tx.guide.update({
    where: { id: input.guideId },
    data: { coverMediaId: input.mediaId },
  });
  if (input.previousMediaId && input.previousMediaId !== input.mediaId) {
    await tx.mediaAsset.updateMany({
      where: {
        id: input.previousMediaId,
        attachmentType: "GUIDE",
        attachmentId: input.guideId,
        retainedAt: null,
      },
      data: { attachedAt: null, attachmentType: null, attachmentId: null },
    });
  }
}

export async function listAdminGuides(
  actor: Actor,
  input: {
    page?: number;
    pageSize?: number;
    query?: string;
    published?: boolean;
    /** Lets a reviewer pull up the queue of unverified guides directly. */
    contentStatus?: GuideContentStatus;
  } = {},
) {
  if (!hasAdminPermission(actor.role, "GUIDE_CMS_VIEW")) {
    throw new GuideError("Access denied.", 403);
  }
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(50, Math.max(5, Math.floor(input.pageSize ?? 20)));
  const where: Prisma.GuideWhereInput = {
    published: input.published,
    contentStatus: input.contentStatus,
    ...(input.query
      ? {
          OR: [
            { title: { contains: input.query, mode: "insensitive" } },
            { slug: { contains: input.query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [total, guides] = await Promise.all([
    prisma.guide.count({ where }),
    prisma.guide.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        published: true,
        featured: true,
        estimatedMinutes: true,
        updatedAt: true,
        contentStatus: true,
        reviewDueAt: true,
        _count: { select: { steps: true, sources: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  // Resolved here rather than at render, so the list is a pure function of it.
  const now = Date.now();
  return {
    records: guides.map((guide) => ({
      ...guide,
      updatedAt: guide.updatedAt.toISOString(),
      reviewDueAt: guide.reviewDueAt?.toISOString() ?? null,
      reviewOverdue: guide.reviewDueAt
        ? guide.reviewDueAt.getTime() < now
        : false,
    })),
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
  };
}

export async function getAdminGuide(actor: Actor, guideId: string) {
  if (!hasAdminPermission(actor.role, "GUIDE_CMS_VIEW")) {
    throw new GuideError("Access denied.", 403);
  }
  const guide = await prisma.guide.findUnique({
    where: { id: guideId },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      coverMediaId: true,
      category: true,
      estimatedMinutes: true,
      published: true,
      featured: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      // What Kondo claims about this guide, as opposed to what it says.
      contentStatus: true,
      lastVerifiedAt: true,
      reviewDueAt: true,
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      sources: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          title: true,
          url: true,
          organization: true,
          isOfficial: true,
        },
      },
      steps: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          title: true,
          content: true,
          actionUrl: true,
          _count: { select: { progress: true } },
        },
      },
    },
  });
  if (!guide) return null;
  return {
    ...guide,
    publishedAt: guide.publishedAt?.toISOString() ?? null,
    createdAt: guide.createdAt.toISOString(),
    updatedAt: guide.updatedAt.toISOString(),
  };
}

export async function createGuide(input: {
  actor: Actor;
  data: {
    title: string;
    summary: string;
    category: GuideCategory;
    estimatedMinutes: number;
    featured?: boolean;
    coverMediaId?: string | null;
  };
  meta?: RequestMeta;
}) {
  if (!hasAdminPermission(input.actor.role, "GUIDE_CMS_MANAGE")) {
    throw new GuideError("Access denied.", 403);
  }
  const slug = await uniqueGuideSlug(input.data.title);
  return prisma.$transaction(async (tx) => {
    const guide = await tx.guide.create({
      data: {
        slug,
        title: input.data.title,
        summary: input.data.summary,
        category: input.data.category,
        estimatedMinutes: input.data.estimatedMinutes,
        featured: input.data.featured ?? false,
        published: false,
        createdById: input.actor.id,
      },
      select: { id: true, slug: true, title: true, published: true },
    });
    if (input.data.coverMediaId) {
      await attachGuideCover(tx, {
        actorId: input.actor.id,
        guideId: guide.id,
        mediaId: input.data.coverMediaId,
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "GUIDE_CREATED",
      entityType: "Guide",
      entityId: guide.id,
      newValue: { title: guide.title, slug: guide.slug },
      ...input.meta,
    });
    return { guide };
  });
}

export async function updateGuide(input: {
  actor: Actor;
  guideId: string;
  data: {
    title?: string;
    summary?: string;
    category?: GuideCategory;
    estimatedMinutes?: number;
    featured?: boolean;
    coverMediaId?: string | null;
  };
  meta?: RequestMeta;
}) {
  if (!hasAdminPermission(input.actor.role, "GUIDE_CMS_MANAGE")) {
    throw new GuideError("Access denied.", 403);
  }
  return prisma.$transaction(async (tx) => {
    const current = await tx.guide.findUnique({
      where: { id: input.guideId },
      select: { id: true, coverMediaId: true },
    });
    if (!current) throw new GuideError("Guide not found.", 404);
    const { coverMediaId, ...fields } = input.data;
    const updated = await tx.guide.update({
      where: { id: current.id },
      data: fields,
      select: { id: true, slug: true, title: true, published: true },
    });
    if (coverMediaId && coverMediaId !== current.coverMediaId) {
      await attachGuideCover(tx, {
        actorId: input.actor.id,
        guideId: current.id,
        mediaId: coverMediaId,
        previousMediaId: current.coverMediaId,
      });
    }
    if (coverMediaId === null && current.coverMediaId) {
      await tx.guide.update({
        where: { id: current.id },
        data: { coverMediaId: null },
      });
      await tx.mediaAsset.updateMany({
        where: {
          id: current.coverMediaId,
          attachmentType: "GUIDE",
          attachmentId: current.id,
          retainedAt: null,
        },
        data: { attachedAt: null, attachmentType: null, attachmentId: null },
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "GUIDE_UPDATED",
      entityType: "Guide",
      entityId: updated.id,
      newValue: { changedFields: Object.keys(input.data) },
      ...input.meta,
    });
    return { guide: updated };
  });
}

export async function setGuidePublished(input: {
  actor: Actor;
  guideId: string;
  published: boolean;
  meta?: RequestMeta;
}) {
  if (!hasAdminPermission(input.actor.role, "GUIDE_CMS_MANAGE")) {
    throw new GuideError("Access denied.", 403);
  }
  return prisma.$transaction(async (tx) => {
    const guide = await tx.guide.findUnique({
      where: { id: input.guideId },
      select: {
        id: true,
        published: true,
        _count: { select: { steps: true } },
      },
    });
    if (!guide) throw new GuideError("Guide not found.", 404);
    if (input.published && guide._count.steps === 0) {
      throw new GuideError(
        "Add at least one step before publishing this guide.",
        409,
      );
    }
    const updated = await tx.guide.update({
      where: { id: guide.id },
      data: {
        published: input.published,
        publishedAt: input.published ? new Date() : null,
      },
      select: { id: true, published: true, publishedAt: true },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: input.published ? "GUIDE_PUBLISHED" : "GUIDE_UNPUBLISHED",
      entityType: "Guide",
      entityId: guide.id,
      oldValue: { published: guide.published },
      newValue: { published: updated.published },
      ...input.meta,
    });
    return {
      guide: {
        ...updated,
        publishedAt: updated.publishedAt?.toISOString() ?? null,
      },
    };
  });
}

export async function deleteGuide(input: {
  actor: Actor;
  guideId: string;
  meta?: RequestMeta;
}) {
  if (!hasAdminPermission(input.actor.role, "GUIDE_CMS_MANAGE")) {
    throw new GuideError("Access denied.", 403);
  }
  return prisma.$transaction(async (tx) => {
    const guide = await tx.guide.findUnique({
      where: { id: input.guideId },
      select: {
        id: true,
        title: true,
        published: true,
        coverMediaId: true,
        steps: { select: { _count: { select: { progress: true } } } },
      },
    });
    if (!guide) throw new GuideError("Guide not found.", 404);
    if (guide.published) {
      throw new GuideError("Unpublish this guide before deleting it.", 409);
    }
    const hasProgress = guide.steps.some((step) => step._count.progress > 0);
    if (hasProgress) {
      throw new GuideError(
        "This guide has recorded member progress and cannot be deleted.",
        409,
      );
    }
    await tx.guide.delete({ where: { id: guide.id } });
    if (guide.coverMediaId) {
      await tx.mediaAsset.updateMany({
        where: {
          id: guide.coverMediaId,
          attachmentType: "GUIDE",
          attachmentId: guide.id,
          retainedAt: null,
        },
        data: { attachedAt: null, attachmentType: null, attachmentId: null },
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "GUIDE_DELETED",
      entityType: "Guide",
      entityId: guide.id,
      oldValue: { title: guide.title },
      ...input.meta,
    });
    return { deleted: true };
  });
}

export async function upsertGuideStep(input: {
  actor: Actor;
  guideId: string;
  stepId?: string;
  data: {
    order: number;
    title: string;
    content: string;
    actionUrl?: string | null;
  };
  meta?: RequestMeta;
}) {
  if (!hasAdminPermission(input.actor.role, "GUIDE_CMS_MANAGE")) {
    throw new GuideError("Access denied.", 403);
  }
  return prisma.$transaction(async (tx) => {
    const guide = await tx.guide.findUnique({
      where: { id: input.guideId },
      select: { id: true },
    });
    if (!guide) throw new GuideError("Guide not found.", 404);
    try {
      const step = input.stepId
        ? await tx.guideStep.update({
            where: { id: input.stepId },
            data: input.data,
          })
        : await tx.guideStep.create({
            data: { ...input.data, guideId: guide.id },
          });
      await writeAuditLogWithClient(tx, {
        actorId: input.actor.id,
        action: input.stepId ? "GUIDE_STEP_UPDATED" : "GUIDE_STEP_CREATED",
        entityType: "GuideStep",
        entityId: step.id,
        newValue: { guideId: guide.id, order: step.order, title: step.title },
        ...input.meta,
      });
      return { step };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new GuideError(
          "Another step already uses that order position.",
          409,
        );
      }
      throw error;
    }
  });
}

export async function deleteGuideStep(input: {
  actor: Actor;
  guideId: string;
  stepId: string;
  meta?: RequestMeta;
}) {
  if (!hasAdminPermission(input.actor.role, "GUIDE_CMS_MANAGE")) {
    throw new GuideError("Access denied.", 403);
  }
  return prisma.$transaction(async (tx) => {
    const step = await tx.guideStep.findUnique({
      where: { id: input.stepId },
      select: { id: true, guideId: true, title: true },
    });
    if (!step || step.guideId !== input.guideId) {
      throw new GuideError("Step not found.", 404);
    }
    await tx.guideStep.delete({ where: { id: step.id } });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "GUIDE_STEP_DELETED",
      entityType: "GuideStep",
      entityId: step.id,
      oldValue: { guideId: step.guideId, title: step.title },
      ...input.meta,
    });
    return { deleted: true };
  });
}

/**
 * Move a guide through its content lifecycle, and record who vouched for it.
 *
 * Verification is a claim about the world: that someone opened the cited
 * sources and confirmed the steps still match them. Three things follow.
 *
 * It needs its own permission. Writing a guide and vouching for one are
 * different acts, and `GUIDE_CMS_MANAGE` — which any admin editing content
 * holds — must not be enough to make Kondo assert something is checked.
 *
 * It needs a source. A guide nobody can trace is not verified however
 * carefully it was written; the reader has nothing to check it against.
 *
 * It records the person and the moment. `lastVerifiedAt` is set here rather
 * than typed in, so it always means "when this was actually reviewed" and can
 * never be back-dated to make stale content look fresh.
 */
export async function setGuideContentStatus(input: {
  actor: Actor;
  guideId: string;
  /** Omitted when only the review date is being changed. */
  status?: "DRAFT" | "NEEDS_REVIEW" | "VERIFIED" | "ARCHIVED";
  /** When it should be looked at again. Rules change; the date makes that visible. */
  reviewDueAt?: Date | null;
  meta?: RequestMeta;
}) {
  const verifying = input.status === "VERIFIED";
  const permission = verifying ? "GUIDE_CONTENT_VERIFY" : "GUIDE_CMS_MANAGE";
  if (!hasAdminPermission(input.actor.role, permission)) {
    throw new GuideError(
      verifying
        ? "Marking a guide verified requires the guide review permission."
        : "Access denied.",
      403,
    );
  }

  return prisma.$transaction(async (tx) => {
    const current = await tx.guide.findUnique({
      where: { id: input.guideId },
      select: {
        id: true,
        title: true,
        contentStatus: true,
        _count: { select: { sources: true } },
      },
    });
    if (!current) throw new GuideError("Guide not found.", 404);

    if (verifying && current._count.sources === 0) {
      throw new GuideError(
        "Add at least one source before marking this guide verified.",
        422,
      );
    }

    const guide = await tx.guide.update({
      where: { id: input.guideId },
      data: {
        ...(input.status === undefined
          ? {}
          : {
              contentStatus: input.status,
              // Stamped on verification, cleared when the claim is withdrawn,
              // so the date can never outlive the status it belongs to.
              lastVerifiedAt: verifying ? new Date() : null,
              lastVerifiedById: verifying ? input.actor.id : null,
            }),
        ...(input.reviewDueAt === undefined
          ? {}
          : { reviewDueAt: input.reviewDueAt }),
      },
      select: {
        id: true,
        contentStatus: true,
        lastVerifiedAt: true,
        reviewDueAt: true,
      },
    });

    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action:
        input.status === undefined
          ? "GUIDE_REVIEW_DATE_CHANGED"
          : "GUIDE_CONTENT_STATUS_CHANGED",
      entityType: "Guide",
      entityId: guide.id,
      oldValue: { contentStatus: current.contentStatus },
      newValue: {
        contentStatus: guide.contentStatus,
        reviewDueAt: guide.reviewDueAt?.toISOString() ?? null,
      },
      ...input.meta,
    });
    return {
      guide: {
        ...guide,
        lastVerifiedAt: guide.lastVerifiedAt?.toISOString() ?? null,
        reviewDueAt: guide.reviewDueAt?.toISOString() ?? null,
      },
    };
  });
}

/** Add a citation. Sources are what make verification checkable by a reader. */
export async function addGuideSource(input: {
  actor: Actor;
  guideId: string;
  data: {
    title: string;
    url: string;
    organization?: string | null;
    isOfficial?: boolean;
  };
  meta?: RequestMeta;
}) {
  if (!hasAdminPermission(input.actor.role, "GUIDE_CMS_MANAGE")) {
    throw new GuideError("Access denied.", 403);
  }
  return prisma.$transaction(async (tx) => {
    // Checked rather than left to the foreign key, so a stale admin tab gets a
    // 404 it can explain instead of a 500 it cannot.
    const guide = await tx.guide.findUnique({
      where: { id: input.guideId },
      select: { id: true },
    });
    if (!guide) throw new GuideError("Guide not found.", 404);

    const count = await tx.guideSource.count({
      where: { guideId: input.guideId },
    });
    const source = await tx.guideSource.create({
      data: {
        guideId: input.guideId,
        title: input.data.title,
        url: input.data.url,
        organization: input.data.organization ?? null,
        isOfficial: input.data.isOfficial ?? false,
        sortOrder: count,
      },
      select: {
        id: true,
        title: true,
        url: true,
        organization: true,
        isOfficial: true,
      },
    });

    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "GUIDE_SOURCE_ADDED",
      entityType: "Guide",
      entityId: input.guideId,
      newValue: { title: source.title, url: source.url },
      ...input.meta,
    });
    return { source };
  });
}

/**
 * Remove a citation.
 *
 * Removing the last source from a verified guide would leave it claiming a
 * verification the reader can no longer check, so the guide falls back to
 * needing review rather than silently keeping its badge.
 */
export async function removeGuideSource(input: {
  actor: Actor;
  sourceId: string;
  meta?: RequestMeta;
}) {
  if (!hasAdminPermission(input.actor.role, "GUIDE_CMS_MANAGE")) {
    throw new GuideError("Access denied.", 403);
  }
  return prisma.$transaction(async (tx) => {
    const source = await tx.guideSource.findUnique({
      where: { id: input.sourceId },
      select: { id: true, guideId: true, title: true, url: true },
    });
    if (!source) throw new GuideError("Source not found.", 404);
    await tx.guideSource.delete({ where: { id: source.id } });

    const remaining = await tx.guideSource.count({
      where: { guideId: source.guideId },
    });
    let demoted = false;
    if (remaining === 0) {
      const { count } = await tx.guide.updateMany({
        where: { id: source.guideId, contentStatus: "VERIFIED" },
        data: {
          contentStatus: "NEEDS_REVIEW",
          lastVerifiedAt: null,
          lastVerifiedById: null,
        },
      });
      demoted = count > 0;
    }

    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "GUIDE_SOURCE_REMOVED",
      entityType: "Guide",
      entityId: source.guideId,
      oldValue: { title: source.title, url: source.url },
      newValue: demoted ? { contentStatus: "NEEDS_REVIEW" } : undefined,
      ...input.meta,
    });
    return { deleted: true, remaining, demoted };
  });
}
