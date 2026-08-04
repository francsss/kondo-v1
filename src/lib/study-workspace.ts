import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { StudyEssentialError } from "@/lib/study-essentials";

/**
 * The study workspace — the part of Study Essentials that is not a shop.
 *
 * Ownership is derived from paid orders rather than stored a second time, so
 * a purchase appears in My Library with nothing left to keep in sync. Reading
 * a resource produces highlights, a highlight becomes a note, and a note can
 * raise a task in the existing planner. Tasks are never re-implemented here:
 * `AcademicTask` stays the single owner and the note holds the link.
 */

export const STUDY_ESSENTIAL_SECTIONS = [
  { key: "browse", label: "Browse", href: "/student-hub/essentials" },
  { key: "library", label: "My Library", href: "/student-hub/essentials/library" },
  { key: "notes", label: "Notes", href: "/student-hub/essentials/notes" },
] as const;

export type StudyEssentialSectionKey =
  (typeof STUDY_ESSENTIAL_SECTIONS)[number]["key"];

/** Every essential the member has paid for, newest acquisition first. */
export async function listLibrary(userId: string) {
  const orders = await prisma.studyEssentialOrder.findMany({
    where: { userId, status: "PAID" },
    orderBy: { placedAt: "desc" },
    select: {
      placedAt: true,
      essential: {
        select: {
          id: true,
          slug: true,
          title: true,
          shortDescription: true,
          category: true,
          format: true,
          source: true,
          coverEmoji: true,
          imageUrl: true,
          externalUrl: true,
          providerName: true,
          _count: { select: { chapters: true } },
        },
      },
    },
  });

  // One essential can be ordered more than once; the library lists it once,
  // dated from the first time it was acquired.
  const seen = new Map<string, (typeof orders)[number]>();
  for (const order of orders) {
    const existing = seen.get(order.essential.id);
    if (!existing || order.placedAt < existing.placedAt) {
      seen.set(order.essential.id, order);
    }
  }
  return [...seen.values()].sort(
    (first, second) => second.placedAt.getTime() - first.placedAt.getTime(),
  );
}

export async function ownsEssential(userId: string, essentialId: string) {
  const order = await prisma.studyEssentialOrder.findFirst({
    where: { userId, essentialId, status: "PAID" },
    select: { id: true },
  });
  return Boolean(order);
}

const readerSelect = {
  id: true,
  slug: true,
  title: true,
  format: true,
  coverEmoji: true,
  imageUrl: true,
  chapters: {
    orderBy: { position: "asc" as const },
    select: { id: true, position: true, title: true, body: true },
  },
} satisfies Prisma.StudyEssentialSelect;

/**
 * Loads a readable resource for a member who owns it.
 *
 * Ownership is checked here rather than in the page so every caller —
 * including a future API — goes through the same gate.
 */
export async function getReadableEssential(userId: string, slug: string) {
  const essential = await prisma.studyEssential.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: readerSelect,
  });
  if (!essential) return null;
  if (!(await ownsEssential(userId, essential.id))) {
    throw new StudyEssentialError(
      "This resource is not in your library yet.",
      403,
    );
  }
  const [progress, notes] = await Promise.all([
    prisma.studyReadingProgress.findUnique({
      where: { userId_essentialId: { userId, essentialId: essential.id } },
      select: { chapterId: true, lastReadAt: true },
    }),
    prisma.studyNote.findMany({
      where: { userId, essentialId: essential.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        chapterId: true,
        highlight: true,
        body: true,
        taskId: true,
        createdAt: true,
      },
    }),
  ]);
  return { essential, progress, notes };
}

export async function saveReadingProgress(input: {
  userId: string;
  essentialId: string;
  chapterId: string;
}) {
  const chapter = await prisma.studyEssentialChapter.findFirst({
    where: { id: input.chapterId, essentialId: input.essentialId },
    select: { id: true },
  });
  if (!chapter) throw new StudyEssentialError("Unknown chapter.", 404);
  if (!(await ownsEssential(input.userId, input.essentialId))) {
    throw new StudyEssentialError("This resource is not in your library.", 403);
  }
  return prisma.studyReadingProgress.upsert({
    where: {
      userId_essentialId: {
        userId: input.userId,
        essentialId: input.essentialId,
      },
    },
    create: {
      userId: input.userId,
      essentialId: input.essentialId,
      chapterId: input.chapterId,
    },
    update: { chapterId: input.chapterId, lastReadAt: new Date() },
    select: { chapterId: true },
  });
}

/**
 * Creates a note from a highlight, optionally raising a planner task.
 *
 * The task is a plain `AcademicTask`, created with the same shape the planner
 * creates, so it appears in Tasks with no special handling. Its description
 * carries the source so the student can tell where it came from.
 */
export async function createStudyNote(input: {
  userId: string;
  essentialSlug: string;
  chapterId?: string | null;
  highlight?: string | null;
  body?: string | null;
  task?: { title: string; dueAt?: Date | null } | null;
}) {
  const highlight = input.highlight?.trim() || null;
  const body = input.body?.trim() || null;
  if (!highlight && !body) {
    throw new StudyEssentialError("Add a highlight or write a note.");
  }

  return prisma.$transaction(async (tx) => {
    const essential = await tx.studyEssential.findFirst({
      where: { slug: input.essentialSlug, status: "PUBLISHED" },
      select: { id: true, title: true },
    });
    if (!essential) throw new StudyEssentialError("Unknown resource.", 404);

    const owned = await tx.studyEssentialOrder.findFirst({
      where: { userId: input.userId, essentialId: essential.id, status: "PAID" },
      select: { id: true },
    });
    if (!owned) {
      throw new StudyEssentialError(
        "This resource is not in your library.",
        403,
      );
    }

    let chapter: { id: string; title: string } | null = null;
    if (input.chapterId) {
      chapter = await tx.studyEssentialChapter.findFirst({
        where: { id: input.chapterId, essentialId: essential.id },
        select: { id: true, title: true },
      });
      if (!chapter) throw new StudyEssentialError("Unknown chapter.", 404);
    }

    let taskId: string | null = null;
    if (input.task) {
      const title = input.task.title.trim();
      if (!title) throw new StudyEssentialError("Give the task a title.");
      const source = [essential.title, chapter?.title]
        .filter(Boolean)
        .join(" · ");
      const task = await tx.academicTask.create({
        data: {
          ownerId: input.userId,
          title: title.slice(0, 200),
          description: [`From ${source}`, highlight ? `“${highlight}”` : null]
            .filter(Boolean)
            .join("\n\n")
            .slice(0, 2000),
          kind: "ASSIGNMENT",
          dueAt: input.task.dueAt ?? undefined,
        },
        select: { id: true },
      });
      taskId = task.id;
    }

    return tx.studyNote.create({
      data: {
        userId: input.userId,
        essentialId: essential.id,
        chapterId: chapter?.id ?? null,
        highlight,
        body,
        taskId,
      },
      select: { id: true, taskId: true },
    });
  });
}

export async function deleteStudyNote(userId: string, noteId: string) {
  const note = await prisma.studyNote.findFirst({
    where: { id: noteId, userId },
    select: { id: true },
  });
  if (!note) throw new StudyEssentialError("Note not found.", 404);
  // The task, if any, stays in the planner: it is the planner's record now.
  await prisma.studyNote.delete({ where: { id: note.id } });
}

export async function listStudyNotes(userId: string) {
  return prisma.studyNote.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      highlight: true,
      body: true,
      createdAt: true,
      taskId: true,
      task: { select: { title: true, status: true } },
      chapter: { select: { title: true } },
      essential: {
        select: { slug: true, title: true, coverEmoji: true, imageUrl: true },
      },
    },
  });
}
