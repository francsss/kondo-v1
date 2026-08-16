import type { PrismaClient } from "@prisma/client";
import {
  GUIDE_CONTENT_PACK,
  SUPERSEDED_GUIDE_SLUGS,
} from "@/lib/guide-content-pack";

/**
 * Loads the guide content pack into a database that does not have it.
 *
 * The pack normally arrives through a migration. That works for a database
 * that already has users, and cannot work for one that does not: on a fresh
 * database migrations run before seeds, the migration finds no admin to
 * attribute the content to, returns early, and is then recorded as applied —
 * so the library never loads and never will. Every fresh environment, CI
 * included, came up with no guides at all.
 *
 * So the seed loads it too, from this function, from the same pack module the
 * migration was generated from. Two callers, one source of truth.
 *
 * Idempotent by slug: a guide that already exists is left completely alone,
 * including any status, sources or review dates an editor has since set. It
 * fills gaps; it never overwrites.
 */
export async function loadGuideContentPack(
  prisma: PrismaClient,
  authorId: string,
) {
  const existing = await prisma.guide.findMany({
    where: { slug: { in: GUIDE_CONTENT_PACK.map((guide) => guide.slug) } },
    select: { slug: true },
  });
  const have = new Set(existing.map((guide) => guide.slug));

  let created = 0;
  for (const guide of GUIDE_CONTENT_PACK) {
    if (have.has(guide.slug)) continue;
    await prisma.guide.create({
      data: {
        slug: guide.slug,
        title: guide.title,
        summary: guide.summary,
        category: guide.category,
        estimatedMinutes: guide.estimatedMinutes,
        published: guide.published,
        featured: false,
        contentStatus: guide.status,
        reviewDueAt: new Date(guide.reviewBy),
        createdById: authorId,
        // Only a published guide has a publication date; a DRAFT has not been
        // published, and saying otherwise would misdate it.
        publishedAt: guide.published ? new Date() : null,
        steps: {
          create: guide.steps.map((step, order) => ({
            order,
            title: step.title,
            content: step.content,
          })),
        },
        sources: {
          create: guide.sources.map((source, sortOrder) => ({
            title: source.title,
            url: source.url,
            organization: source.organization,
            isOfficial: source.isOfficial,
            sortOrder,
          })),
        },
      },
    });
    created += 1;
  }

  /*
   * Archived, never deleted. Deleting a guide cascades through GuideStep to
   * GuideProgress, which is a student's own checklist history; withdrawing the
   * guide from view costs them nothing, and deleting it costs them that.
   */
  const { count: archived } = await prisma.guide.updateMany({
    where: {
      slug: { in: [...SUPERSEDED_GUIDE_SLUGS] },
      contentStatus: { not: "ARCHIVED" },
    },
    data: { contentStatus: "ARCHIVED", published: false },
  });

  return { created, archived, skipped: have.size };
}
