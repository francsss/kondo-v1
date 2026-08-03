import { createHash, randomUUID } from "node:crypto";
import { writeAuditLogWithClient } from "@/lib/audit";
import {
  DEMO_STORIES,
  DEMO_STORY_SOURCE_COMMIT,
} from "@/lib/demo-stories-manifest";
import { prisma } from "@/lib/prisma";
import { getObjectStorage } from "@/lib/storage";

const RAW_ASSET_ROOT = `https://raw.githubusercontent.com/francsss/kondo-v1/${DEMO_STORY_SOURCE_COMMIT}/assets/demo-stories`;

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function downloadVerifiedAsset(
  name: string,
  extension: "jpg" | "mp4",
  expectedSha256: string,
) {
  const response = await fetch(`${RAW_ASSET_ROOT}/${name}.${extension}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(
      `Demo Story asset download failed (${response.status}) for ${name}.${extension}.`,
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (sha256(bytes) !== expectedSha256) {
    throw new Error(`Demo Story checksum mismatch for ${name}.${extension}.`);
  }
  return bytes;
}

export async function importProductionDemoStories() {
  if (process.env.VERCEL_ENV !== "production") {
    throw new Error(
      "The production Story importer only runs on Vercel Production.",
    );
  }
  if (process.env.STORAGE_DRIVER !== "s3") {
    throw new Error("The production Story importer requires S3/R2 storage.");
  }

  const creator = await prisma.user.findFirst({
    where: {
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: { not: null },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!creator) {
    throw new Error("No active verified Super Admin can own the demo Stories.");
  }

  const storage = getObjectStorage();
  let created = 0;
  let skipped = 0;

  for (const [index, demo] of DEMO_STORIES.entries()) {
    const existing = await prisma.story.findUnique({
      where: { slug: demo.slug },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    const [poster, video] = await Promise.all([
      downloadVerifiedAsset(demo.asset, "jpg", demo.posterSha256),
      downloadVerifiedAsset(demo.asset, "mp4", demo.videoSha256),
    ]);
    const [categorySlug, categoryName, categoryIcon] = demo.category;
    const category = await prisma.storyCategory.upsert({
      where: { slug: categorySlug },
      create: {
        slug: categorySlug,
        name: categoryName,
        icon: categoryIcon,
        description: `Student Stories about ${categoryName.toLowerCase()}.`,
        order: index,
      },
      update: { isActive: true },
      select: { id: true },
    });

    const storyId = randomUUID();
    const posterId = randomUUID();
    const videoId = randomUUID();
    const posterKey = `stories/demo/${demo.slug}/poster.jpg`;
    const videoKey = `stories/demo/${demo.slug}/story.mp4`;
    const writtenKeys: string[] = [];

    try {
      await storage.write(posterKey, poster, "image/jpeg");
      writtenKeys.push(posterKey);
      await storage.write(videoKey, video, "video/mp4");
      writtenKeys.push(videoKey);

      const now = new Date();
      const publishedAt = new Date(now.getTime() - index * 30 * 60 * 1000);
      await prisma.$transaction(async (tx) => {
        await tx.mediaAsset.createMany({
          data: [
            {
              id: posterId,
              ownerId: creator.id,
              objectKey: posterKey,
              storageProvider: storage.provider,
              kind: "IMAGE",
              purpose: "STORY_POSTER",
              visibility: "PUBLIC",
              status: "ACTIVE",
              scanStatus: "CLEAN",
              originalFileName: `${demo.asset}.jpg`,
              extension: "jpg",
              declaredMime: "image/jpeg",
              detectedMime: "image/jpeg",
              sizeBytes: poster.byteLength,
              width: 720,
              height: 1280,
              altText: demo.title,
              checksumSha256: demo.posterSha256,
              uploadExpiresAt: now,
              uploadedAt: now,
              validatedAt: now,
              attachedAt: now,
              attachmentType: "STORY",
              attachmentId: storyId,
            },
            {
              id: videoId,
              ownerId: creator.id,
              objectKey: videoKey,
              storageProvider: storage.provider,
              kind: "VIDEO",
              purpose: "STORY_VIDEO",
              visibility: "PUBLIC",
              status: "ACTIVE",
              scanStatus: "CLEAN",
              originalFileName: `${demo.asset}.mp4`,
              extension: "mp4",
              declaredMime: "video/mp4",
              detectedMime: "video/mp4",
              sizeBytes: video.byteLength,
              durationSeconds: 5,
              checksumSha256: demo.videoSha256,
              uploadExpiresAt: now,
              uploadedAt: now,
              validatedAt: now,
              attachedAt: now,
              attachmentType: "STORY",
              attachmentId: storyId,
            },
          ],
        });
        await tx.story.create({
          data: {
            id: storyId,
            slug: demo.slug,
            creatorId: creator.id,
            categoryId: category.id,
            videoMediaId: videoId,
            posterMediaId: posterId,
            status: "PUBLISHED",
            title: demo.title,
            description: demo.description,
            language: "en",
            durationSeconds: 5,
            commentsEnabled: true,
            isInstitutional: true,
            isFeatured: index < 4,
            qualityScore: 0.9 - index * 0.015,
            publishedAt,
            moderatedAt: now,
            moderationEvents: {
              create: {
                actorId: creator.id,
                toStatus: "PUBLISHED",
                reason: "Approved production demo Story import.",
              },
            },
          },
        });
        await writeAuditLogWithClient(tx, {
          actorId: creator.id,
          action: "story.demo_imported",
          entityType: "Story",
          entityId: storyId,
          newValue: { slug: demo.slug, status: "PUBLISHED" },
        });
      });
      created += 1;
    } catch (error) {
      await Promise.all(
        writtenKeys.map((objectKey) =>
          storage.delete(objectKey).catch(() => undefined),
        ),
      );
      throw error;
    }
  }

  return { created, skipped, total: DEMO_STORIES.length };
}
