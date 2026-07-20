import { Prisma, type GuideCategory } from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { hasAdminPermission, type AppRole } from "@/lib/authorization";
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
    const slug = attempt === 0 ? base : `${base}-${crypto.randomUUID().slice(0, 8)}`;
    const existing = await prisma.guide.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
  }
  throw new GuideError("Could not create a unique guide URL.", 409);
}

export async function listAdminGuides(
  actor: Actor,
  input: {
    page?: number;
    pageSize?: number;
    query?: string;
    published?: boolean;
  } = {},
) {
  if (!hasAdminPermission(actor.role, "GUIDE_CMS_VIEW")) {
    throw new GuideError("Access denied.", 403);
  }
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(50, Math.max(5, Math.floor(input.pageSize ?? 20)));
  const where: Prisma.GuideWhereInput = {
    published: input.published,
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
        _count: { select: { steps: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    records: guides.map((guide) => ({
      ...guide,
      updatedAt: guide.updatedAt.toISOString(),
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
      category: true,
      estimatedMinutes: true,
      published: true,
      featured: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, firstName: true, lastName: true } },
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
  };
  meta?: RequestMeta;
}) {
  if (!hasAdminPermission(input.actor.role, "GUIDE_CMS_MANAGE")) {
    throw new GuideError("Access denied.", 403);
  }
  return prisma.$transaction(async (tx) => {
    const current = await tx.guide.findUnique({
      where: { id: input.guideId },
      select: { id: true },
    });
    if (!current) throw new GuideError("Guide not found.", 404);
    const updated = await tx.guide.update({
      where: { id: current.id },
      data: input.data,
      select: { id: true, slug: true, title: true, published: true },
    });
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
      select: { id: true, published: true, _count: { select: { steps: true } } },
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
