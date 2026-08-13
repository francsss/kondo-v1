import type { MediaPurpose, Prisma } from "@prisma/client";
import { attachMediaAsset } from "@/lib/media";
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
  {
    key: "library",
    label: "My Library",
    href: "/student-hub/essentials/library",
  },
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

/**
 * Which of these essentials the member already owns, in one query.
 *
 * Ownership has exactly one definition in Kondo — a PAID
 * `StudyEssentialOrder` — and this reads it rather than keeping a second copy.
 * The store grid needs the answer for a page of items at once, and asking
 * `ownsEssential` per card would be one round trip per product.
 */
export async function ownedEssentialIds(
  userId: string,
  essentialIds: string[],
) {
  if (!essentialIds.length) return new Set<string>();
  const orders = await prisma.studyEssentialOrder.findMany({
    where: { userId, status: "PAID", essentialId: { in: essentialIds } },
    select: { essentialId: true },
  });
  return new Set(orders.map((order) => order.essentialId));
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
      where: {
        userId: input.userId,
        essentialId: essential.id,
        status: "PAID",
      },
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

/**
 * The resources a student has attached to a course.
 *
 * `CourseResource` records study context, never ownership, so this joins back
 * to the library gate: a link to a resource the student no longer owns simply
 * does not surface. Reading progress rides along, because the only thing
 * Workspace wants to say about a book is where to resume it.
 */
export async function listCourseResources(userId: string, courseId: string) {
  const links = await prisma.courseResource.findMany({
    where: { userId, course: { id: courseId, schedule: { ownerId: userId } } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      essential: {
        select: {
          id: true,
          slug: true,
          title: true,
          format: true,
          coverEmoji: true,
          imageUrl: true,
          providerName: true,
          _count: { select: { chapters: true } },
        },
      },
    },
  });
  if (!links.length) return [];

  const essentialIds = links.map((link) => link.essential.id);
  // Two more queries for the whole list rather than two per resource.
  const [owned, progress] = await Promise.all([
    prisma.studyEssentialOrder.findMany({
      where: { userId, status: "PAID", essentialId: { in: essentialIds } },
      select: { essentialId: true },
    }),
    prisma.studyReadingProgress.findMany({
      where: { userId, essentialId: { in: essentialIds } },
      select: {
        essentialId: true,
        lastReadAt: true,
        chapter: { select: { id: true, title: true, position: true } },
      },
    }),
  ]);
  const ownedIds = new Set(owned.map((order) => order.essentialId));
  const progressByEssential = new Map(
    progress.map((row) => [row.essentialId, row]),
  );

  return links
    .filter((link) => ownedIds.has(link.essential.id))
    .map((link) => ({
      linkId: link.id,
      ...link.essential,
      chapterCount: link.essential._count.chapters,
      progress: progressByEssential.get(link.essential.id) ?? null,
    }));
}

/**
 * What the student could attach: everything they own that is not linked yet.
 * Loaded only when the picker opens, never with the course screen.
 */
export async function listLinkableResources(userId: string, courseId: string) {
  const [library, alreadyLinked] = await Promise.all([
    listLibrary(userId),
    prisma.courseResource.findMany({
      where: { userId, courseId },
      select: { essentialId: true },
    }),
  ]);
  const linked = new Set(alreadyLinked.map((link) => link.essentialId));
  return library
    .filter((entry) => !linked.has(entry.essential.id))
    .map((entry) => ({
      id: entry.essential.id,
      slug: entry.essential.slug,
      title: entry.essential.title,
      coverEmoji: entry.essential.coverEmoji,
      imageUrl: entry.essential.imageUrl,
      format: entry.essential.format,
    }));
}

/** Attach an owned resource to a course the student owns. Idempotent. */
export async function linkCourseResource(input: {
  userId: string;
  courseId: string;
  essentialId: string;
}) {
  const course = await prisma.scheduleCourse.findFirst({
    where: { id: input.courseId, schedule: { ownerId: input.userId } },
    select: { id: true },
  });
  if (!course) throw new StudyEssentialError("Course not found.", 404);
  // Linking a resource the student does not own would let Workspace advertise
  // something the reader will refuse to open.
  if (!(await ownsEssential(input.userId, input.essentialId))) {
    throw new StudyEssentialError("This resource is not in your library.", 403);
  }
  return prisma.courseResource.upsert({
    where: {
      userId_courseId_essentialId: {
        userId: input.userId,
        courseId: input.courseId,
        essentialId: input.essentialId,
      },
    },
    create: input,
    update: {},
    select: { id: true },
  });
}

export async function unlinkCourseResource(userId: string, linkId: string) {
  const deleted = await prisma.courseResource.deleteMany({
    where: { id: linkId, userId },
  });
  if (!deleted.count) throw new StudyEssentialError("Link not found.", 404);
}

export type CourseActivityEntry = {
  id: string;
  createdAt: Date;
  /** What the entry is, which decides its icon and how it opens. */
  kind: "NOTE" | "PHOTO" | "DOCUMENT" | "VOICE" | "HIGHLIGHT";
  /** The line the student reads in the list. */
  title: string;
  /** Where it came from: a book and chapter, or nothing for a class capture. */
  source: string | null;
  /** Set when the entry has a file behind it, served by `/api/media/[id]`. */
  mediaId: string | null;
  /** Set when this entry raised a planner task. */
  hasTask: boolean;
};

export type CourseActivityDay = {
  /** `YYYY-MM-DD`, so the key is stable and the client does no parsing. */
  key: string;
  date: Date;
  entries: CourseActivityEntry[];
};

const CAPTURE_FALLBACK_TITLE: Record<string, string> = {
  PHOTO: "Photo",
  DOCUMENT: "Document",
  VOICE: "Voice note",
  NOTE: "Note",
};

/**
 * Everything the student has recorded for one course, newest first, grouped by
 * the day it happened.
 *
 * Two sources meet here and neither is copied. Notes and highlights belong to
 * the books linked to this course (`StudyNote`, reached through
 * `CourseResource`); photos, handouts, voice notes and typed lines belong to
 * the class itself (`CourseCapture`). A student thinks of both as "what I did
 * in this class", so they are merged and then cut by day — which is what makes
 * a run of captures read as one session instead of a flat feed.
 */
export async function listCourseActivity(
  userId: string,
  courseId: string,
  limit = 24,
): Promise<CourseActivityDay[]> {
  const links = await prisma.courseResource.findMany({
    where: { userId, course: { id: courseId, schedule: { ownerId: userId } } },
    select: { essentialId: true },
  });

  const [notes, captures] = await Promise.all([
    links.length
      ? prisma.studyNote.findMany({
          where: {
            userId,
            essentialId: { in: links.map((link) => link.essentialId) },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            body: true,
            highlight: true,
            createdAt: true,
            taskId: true,
            essential: { select: { title: true } },
            chapter: { select: { title: true } },
          },
        })
      : Promise.resolve([]),
    prisma.courseCapture.findMany({
      // Ownership through the schedule, not from the URL — the same rule the
      // rest of Workspace follows.
      where: {
        userId,
        course: { id: courseId, schedule: { ownerId: userId } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        kind: true,
        body: true,
        createdAt: true,
        media: { select: { id: true, status: true } },
      },
    }),
  ]);

  const entries: CourseActivityEntry[] = [
    ...notes.map((note) => ({
      id: `note-${note.id}`,
      createdAt: note.createdAt,
      kind: (note.body?.trim() ? "NOTE" : "HIGHLIGHT") as "NOTE" | "HIGHLIGHT",
      title: note.body?.trim() || note.highlight?.trim() || "Highlight",
      source: [note.essential.title, note.chapter?.title]
        .filter(Boolean)
        .join(" · "),
      mediaId: null,
      hasTask: Boolean(note.taskId),
    })),
    ...captures.map((capture) => ({
      id: `capture-${capture.id}`,
      createdAt: capture.createdAt,
      kind: capture.kind,
      title: capture.body?.trim() || CAPTURE_FALLBACK_TITLE[capture.kind],
      source: null,
      // A file that never finished validating must not be offered for
      // playback or download.
      mediaId: capture.media?.status === "ACTIVE" ? capture.media.id : null,
      hasTask: false,
    })),
  ]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, limit);

  const days: CourseActivityDay[] = [];
  for (const entry of entries) {
    const key = dayKey(entry.createdAt);
    const current = days.at(-1);
    if (current?.key === key) {
      current.entries.push(entry);
      continue;
    }
    days.push({ key, date: entry.createdAt, entries: [entry] });
  }
  return days;
}

/** Local calendar day of a timestamp, as `YYYY-MM-DD`. */
function dayKey(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * Record one capture against a course.
 *
 * Media is optional and already uploaded by the time this runs: the browser
 * goes through `/api/media/uploads`, which validates the bytes, and only the
 * resulting asset id arrives here. `attachMediaAsset` then binds it to this
 * row, which is what stops an asset being claimed twice.
 */
export async function createCourseCapture(input: {
  userId: string;
  courseId: string;
  kind: "NOTE" | "PHOTO" | "DOCUMENT" | "VOICE";
  body?: string | null;
  mediaId?: string | null;
}) {
  const course = await prisma.scheduleCourse.findFirst({
    where: { id: input.courseId, schedule: { ownerId: input.userId } },
    select: { id: true },
  });
  if (!course) throw new StudyEssentialError("Course not found.", 404);

  const body = input.body?.trim() || null;
  if (!body && !input.mediaId) {
    throw new StudyEssentialError("Nothing to save.", 422);
  }

  return prisma.$transaction(async (tx) => {
    const capture = await tx.courseCapture.create({
      data: {
        userId: input.userId,
        courseId: input.courseId,
        kind: input.kind,
        body,
        mediaId: input.mediaId ?? null,
      },
      select: { id: true, kind: true, body: true, createdAt: true },
    });
    if (input.mediaId) {
      await attachMediaAsset(tx, {
        ownerId: input.userId,
        assetId: input.mediaId,
        purpose: CAPTURE_PURPOSE[input.kind],
        attachmentType: "COURSE_CAPTURE",
        attachmentId: capture.id,
      });
    }
    return capture;
  });
}

const CAPTURE_PURPOSE = {
  PHOTO: "COURSE_CAPTURE_IMAGE",
  DOCUMENT: "COURSE_CAPTURE_DOCUMENT",
  VOICE: "COURSE_CAPTURE_AUDIO",
  // A typed line carries no file, so this is never reached; it exists so the
  // map stays total and the kind cannot silently fall through.
  NOTE: "COURSE_CAPTURE_IMAGE",
} as const satisfies Record<string, MediaPurpose>;

export async function deleteCourseCapture(userId: string, captureId: string) {
  const deleted = await prisma.courseCapture.deleteMany({
    where: { id: captureId, userId },
  });
  if (!deleted.count) throw new StudyEssentialError("Capture not found.", 404);
}
