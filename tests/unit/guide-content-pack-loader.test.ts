import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadGuideContentPack } from "@/lib/guide-content-pack-loader";
import {
  GUIDE_CONTENT_PACK,
  SUPERSEDED_GUIDE_SLUGS,
} from "@/lib/guide-content-pack";

/**
 * The loader exists because the migration that normally ships this content
 * cannot run on a fresh database — it needs an admin the seed has not created
 * yet, and once it returns early it is marked applied forever. These pin the
 * two properties that make a second loader safe to add: it fills gaps without
 * overwriting, and it withdraws superseded guides without deleting them.
 */

const findMany = vi.fn();
const create = vi.fn();
const updateMany = vi.fn();
const deleteMany = vi.fn();

const prisma = {
  guide: { findMany, create, updateMany, deleteMany },
} as unknown as PrismaClient;

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([]);
  create.mockResolvedValue({});
  updateMany.mockResolvedValue({ count: 0 });
});

describe("guide content pack loader", () => {
  it("creates every guide on an empty database", async () => {
    const result = await loadGuideContentPack(prisma, "author-1");
    expect(result.created).toBe(GUIDE_CONTENT_PACK.length);
    expect(create).toHaveBeenCalledTimes(GUIDE_CONTENT_PACK.length);
  });

  it("skips a guide that already exists rather than rewriting it", async () => {
    const [first, second] = GUIDE_CONTENT_PACK;
    findMany.mockResolvedValue([{ slug: first.slug }, { slug: second.slug }]);
    const result = await loadGuideContentPack(prisma, "author-1");
    expect(result.skipped).toBe(2);
    expect(result.created).toBe(GUIDE_CONTENT_PACK.length - 2);
    const slugs = create.mock.calls.map((call) => call[0].data.slug);
    expect(slugs).not.toContain(first.slug);
    expect(slugs).not.toContain(second.slug);
  });

  it("does nothing at all when the pack is already loaded", async () => {
    findMany.mockResolvedValue(
      GUIDE_CONTENT_PACK.map((guide) => ({ slug: guide.slug })),
    );
    const result = await loadGuideContentPack(prisma, "author-1");
    expect(result.created).toBe(0);
    expect(create).not.toHaveBeenCalled();
  });

  it("claims no verification for anything it creates", async () => {
    await loadGuideContentPack(prisma, "author-1");
    for (const call of create.mock.calls) {
      expect(call[0].data.contentStatus).not.toBe("VERIFIED");
      expect(call[0].data).not.toHaveProperty("lastVerifiedAt");
    }
  });

  it("dates only what it actually publishes", async () => {
    await loadGuideContentPack(prisma, "author-1");
    for (const call of create.mock.calls) {
      const { published, publishedAt } = call[0].data;
      if (published) expect(publishedAt).toBeInstanceOf(Date);
      else expect(publishedAt).toBeNull();
    }
  });

  it("archives superseded guides and never deletes one", async () => {
    await loadGuideContentPack(prisma, "author-1");
    const call = updateMany.mock.calls[0][0];
    expect(call.where.slug.in).toEqual([...SUPERSEDED_GUIDE_SLUGS]);
    expect(call.data.contentStatus).toBe("ARCHIVED");
    expect(call.data.published).toBe(false);
    // Deleting cascades into GuideProgress, which is a student's own history.
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
