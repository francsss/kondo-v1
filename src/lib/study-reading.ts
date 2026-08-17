import { prisma } from "@/lib/prisma";
import { checkEntitlement } from "@/lib/study-entitlements";
import { StudyEssentialError } from "@/lib/study-essentials";

/**
 * Reading position and annotations, for members who are entitled to them.
 *
 * Every function here begins by resolving the title and checking the
 * entitlement, so there is no route that can reach a book's notes by knowing
 * its slug. Ownership of the annotation is checked separately from ownership
 * of the book: two members may both own a title, and neither may read the
 * other's notes.
 */

async function requireReadableTitle(userId: string, slug: string) {
  const essential = await prisma.studyEssential.findUnique({
    where: { slug },
    select: { id: true, title: true, aiAllowed: true, deliveryType: true },
  });
  if (!essential) throw new StudyEssentialError("Title not found.", 404);

  const entitlement = await checkEntitlement({
    userId,
    essentialId: essential.id,
  });
  if (!entitlement.allowed) {
    throw new StudyEssentialError(
      entitlement.reason === "EXPIRED"
        ? "Your access to this title has expired."
        : "You do not have access to this title.",
      403,
    );
  }
  return essential;
}

export async function getReadingState(userId: string, slug: string) {
  const essential = await requireReadableTitle(userId, slug);
  const [progress, notes, bookmarks] = await Promise.all([
    prisma.studyReadingProgress.findUnique({
      where: { userId_essentialId: { userId, essentialId: essential.id } },
      select: { locator: true, percentage: true, lastReadAt: true },
    }),
    prisma.studyNote.findMany({
      where: { userId, essentialId: essential.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        locator: true,
        highlight: true,
        body: true,
        color: true,
        createdAt: true,
      },
    }),
    prisma.studyBookmark.findMany({
      where: { userId, essentialId: essential.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, locator: true, label: true, createdAt: true },
    }),
  ]);

  return {
    title: essential.title,
    aiAllowed: essential.aiAllowed,
    progress: progress ?? null,
    notes,
    bookmarks,
  };
}

export async function saveReadingProgress(input: {
  userId: string;
  slug: string;
  locator: string;
  percentage: number;
}) {
  const essential = await requireReadableTitle(input.userId, input.slug);
  // Clamped rather than trusted: the percentage is a display value the client
  // computes, and a bad one should not be able to show "-4% completed".
  const percentage = Math.min(100, Math.max(0, Math.round(input.percentage)));

  return prisma.studyReadingProgress.upsert({
    where: {
      userId_essentialId: { userId: input.userId, essentialId: essential.id },
    },
    update: { locator: input.locator, percentage, lastReadAt: new Date() },
    create: {
      userId: input.userId,
      essentialId: essential.id,
      locator: input.locator,
      percentage,
    },
    select: { locator: true, percentage: true, lastReadAt: true },
  });
}

export async function createAnnotation(input: {
  userId: string;
  slug: string;
  locator: string;
  selectedText?: string | null;
  body?: string | null;
  color?: string | null;
}) {
  const essential = await requireReadableTitle(input.userId, input.slug);
  // A highlight with no text and no note is not an annotation, it is a stray
  // tap. Rejecting it here keeps the notes list meaningful.
  if (!input.selectedText?.trim() && !input.body?.trim()) {
    throw new StudyEssentialError("Add a highlight or a note first.");
  }

  return prisma.studyNote.create({
    data: {
      userId: input.userId,
      essentialId: essential.id,
      locator: input.locator,
      highlight: input.selectedText?.slice(0, 2000) ?? null,
      body: input.body ?? null,
      color: input.color ?? null,
    },
    select: {
      id: true,
      locator: true,
      highlight: true,
      body: true,
      color: true,
      createdAt: true,
    },
  });
}

export async function updateAnnotation(input: {
  userId: string;
  noteId: string;
  body: string;
}) {
  // Scoped by userId in the where clause rather than fetched and compared, so
  // another member's note simply is not found.
  const { count } = await prisma.studyNote.updateMany({
    where: { id: input.noteId, userId: input.userId },
    data: { body: input.body },
  });
  if (count === 0) throw new StudyEssentialError("Note not found.", 404);
  return { updated: true };
}

export async function deleteAnnotation(userId: string, noteId: string) {
  const { count } = await prisma.studyNote.deleteMany({
    where: { id: noteId, userId },
  });
  if (count === 0) throw new StudyEssentialError("Note not found.", 404);
  return { deleted: true };
}

export async function createBookmark(input: {
  userId: string;
  slug: string;
  locator: string;
  label?: string | null;
}) {
  const essential = await requireReadableTitle(input.userId, input.slug);
  // Upsert on the unique triple: bookmarking the same spot twice is a no-op
  // rather than a duplicate row in the list.
  return prisma.studyBookmark.upsert({
    where: {
      userId_essentialId_locator: {
        userId: input.userId,
        essentialId: essential.id,
        locator: input.locator,
      },
    },
    update: { label: input.label ?? undefined },
    create: {
      userId: input.userId,
      essentialId: essential.id,
      locator: input.locator,
      label: input.label ?? null,
    },
    select: { id: true, locator: true, label: true, createdAt: true },
  });
}

export async function deleteBookmark(userId: string, bookmarkId: string) {
  const { count } = await prisma.studyBookmark.deleteMany({
    where: { id: bookmarkId, userId },
  });
  if (count === 0) throw new StudyEssentialError("Bookmark not found.", 404);
  return { deleted: true };
}

export { requireReadableTitle };
