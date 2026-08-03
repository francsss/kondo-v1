import { createHash, randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "../src/lib/prisma";
import { getObjectStorage } from "../src/lib/storage";

const DEMO_STORIES = [
  {
    slug: "demo-arriving-in-china",
    title: "My first hour in China 🇨🇳",
    description:
      "A calm first look at arrival day as an international student.",
    category: ["arrivals", "Arrivals", "✈️"],
    asset: "01-arrival-in-china",
  },
  {
    slug: "demo-jiaxing-campus-walk",
    title: "Morning walk at Jiaxing University",
    description: "The campus route that quickly started to feel like home.",
    category: ["campus-life", "Campus life", "🎓"],
    asset: "02-jiaxing-campus",
  },
  {
    slug: "demo-arrival-checklist",
    title: "Three things I wish I knew before landing",
    description:
      "A quick arrival checklist from one international student to another.",
    category: ["arrivals", "Arrivals", "✈️"],
    asset: "03-arrival-checklist",
  },
  {
    slug: "demo-campus-first-look",
    title: "My first look around campus",
    description:
      "The small landmarks that made a new university easier to navigate.",
    category: ["campus-life", "Campus life", "🎓"],
    asset: "04-campus-first-look",
  },
  {
    slug: "demo-travel-light",
    title: "What I actually packed for China",
    description:
      "A realistic arrival-day look at the essentials that came with me.",
    category: ["arrivals", "Arrivals", "🧳"],
    asset: "05-travel-light",
  },
  {
    slug: "demo-campus-morning",
    title: "Why early mornings on campus feel different",
    description: "A quiet walk before the university day becomes busy.",
    category: ["campus-life", "Campus life", "🌿"],
    asset: "06-campus-morning",
  },
  {
    slug: "demo-new-city-energy",
    title: "That first-day feeling in a new country",
    description:
      "Excitement, nerves, and the beginning of a completely new chapter.",
    category: ["arrivals", "Arrivals", "✨"],
    asset: "07-new-city-energy",
  },
  {
    slug: "demo-campus-after-class",
    title: "The campus route I take after class",
    description: "A familiar path, a slower pace, and a little time to reset.",
    category: ["campus-life", "Campus life", "🚶"],
    asset: "08-campus-after-class",
  },
  {
    slug: "demo-first-week-reflection",
    title: "What my first week in China taught me",
    description:
      "A short reflection for anyone preparing to make the same move.",
    category: ["arrivals", "Arrivals", "💭"],
    asset: "09-first-week-reflection",
  },
  {
    slug: "demo-finding-community",
    title: "Finding your people starts with one hello",
    description: "How everyday campus moments slowly become a real community.",
    category: ["community", "Community", "🤝"],
    asset: "10-finding-community",
  },
] as const;

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function main() {
  if (process.env.KONDO_ALLOW_DEMO_STORIES !== "true") {
    throw new Error(
      "Set KONDO_ALLOW_DEMO_STORIES=true to explicitly create local demo Stories.",
    );
  }
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  ) {
    throw new Error("Demo Stories are forbidden in production.");
  }
  if ((process.env.STORAGE_DRIVER ?? "local") !== "local") {
    throw new Error("Demo Stories may only use local media storage.");
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const databaseHost = new URL(databaseUrl).hostname;
  if (!new Set(["localhost", "127.0.0.1", "::1"]).has(databaseHost)) {
    throw new Error("Demo Stories may only target a loopback database.");
  }

  const creators = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 10,
  });
  if (creators.length < 2) {
    throw new Error("At least two active local users are required.");
  }

  const storage = getObjectStorage();
  const assetRoot = resolve(process.cwd(), "assets/demo-stories");
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

    const posterPath = resolve(assetRoot, `${demo.asset}.jpg`);
    const videoPath = resolve(assetRoot, `${demo.asset}.mp4`);
    const [poster, video, posterInfo, videoInfo] = await Promise.all([
      readFile(posterPath),
      readFile(videoPath),
      stat(posterPath),
      stat(videoPath),
    ]);
    const storyId = randomUUID();
    const posterId = randomUUID();
    const videoId = randomUUID();
    const posterKey = `demo/stories/${storyId}/poster.jpg`;
    const videoKey = `demo/stories/${storyId}/story.mp4`;
    const writtenKeys: string[] = [];

    try {
      await storage.write(posterKey, poster, "image/jpeg");
      writtenKeys.push(posterKey);
      await storage.write(videoKey, video, "video/mp4");
      writtenKeys.push(videoKey);
      const now = new Date();
      const publishedAt = new Date(now.getTime() - index * 30 * 60 * 1000);
      await prisma.$transaction([
        prisma.mediaAsset.create({
          data: {
            id: posterId,
            ownerId: creators[index % creators.length].id,
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
            sizeBytes: posterInfo.size,
            width: 720,
            height: 1280,
            altText: demo.title,
            checksumSha256: sha256(poster),
            uploadExpiresAt: now,
            uploadedAt: now,
            validatedAt: now,
            attachedAt: now,
            attachmentType: "STORY",
            attachmentId: storyId,
          },
        }),
        prisma.mediaAsset.create({
          data: {
            id: videoId,
            ownerId: creators[index % creators.length].id,
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
            sizeBytes: videoInfo.size,
            durationSeconds: 5,
            checksumSha256: sha256(video),
            uploadExpiresAt: now,
            uploadedAt: now,
            validatedAt: now,
            attachedAt: now,
            attachmentType: "STORY",
            attachmentId: storyId,
          },
        }),
        prisma.story.create({
          data: {
            id: storyId,
            slug: demo.slug,
            creatorId: creators[index % creators.length].id,
            categoryId: category.id,
            videoMediaId: videoId,
            posterMediaId: posterId,
            status: "PUBLISHED",
            title: demo.title,
            description: demo.description,
            language: "en",
            durationSeconds: 5,
            commentsEnabled: true,
            isFeatured: index < 4,
            qualityScore: 0.9 - index * 0.015,
            publishedAt,
            moderatedAt: now,
          },
        }),
      ]);
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

  console.log(
    JSON.stringify({ created, skipped, total: DEMO_STORIES.length }, null, 2),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
