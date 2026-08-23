import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Access control on the reading surfaces.
 *
 * The rule these enforce: knowing a slug is not access, and owning a title is
 * not access to someone else's notes about it. Both are the kind of thing that
 * works fine until the day someone tries the other member's id.
 */

const mocks = vi.hoisted(() => ({
  findEssential: vi.fn(),
  checkEntitlement: vi.fn(),
  updateManyNote: vi.fn(),
  deleteManyNote: vi.fn(),
  deleteManyBookmark: vi.fn(),
  upsertProgress: vi.fn(),
  findProgress: vi.fn(),
  findNotes: vi.fn(),
  findBookmarks: vi.fn(),
  createNote: vi.fn(),
  createTask: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    studyEssential: { findUnique: mocks.findEssential },
    studyReadingProgress: {
      findUnique: mocks.findProgress,
      upsert: mocks.upsertProgress,
    },
    studyNote: {
      findMany: mocks.findNotes,
      create: mocks.createNote,
      updateMany: mocks.updateManyNote,
      deleteMany: mocks.deleteManyNote,
    },
    studyBookmark: {
      findMany: mocks.findBookmarks,
      upsert: vi.fn(),
      deleteMany: mocks.deleteManyBookmark,
    },
    academicTask: { create: mocks.createTask },
    // Annotations write a note and, when one is asked for, a planner task in
    // the same commit. The mock runs the callback against the same client.
    $transaction: (run: (tx: unknown) => unknown) => run(client),
  };
  return { prisma: client };
});

vi.mock("@/lib/study-entitlements", () => ({
  checkEntitlement: mocks.checkEntitlement,
}));

import {
  createAnnotation,
  deleteAnnotation,
  getReadingState,
  saveReadingProgress,
  updateAnnotation,
} from "@/lib/study-reading";

const title = {
  id: "book-1",
  title: "Alice's Adventures in Wonderland",
  aiAllowed: true,
  deliveryType: "EPUB",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findEssential.mockResolvedValue(title);
  mocks.checkEntitlement.mockResolvedValue({
    allowed: true,
    reason: "ENTITLED",
  });
  mocks.findProgress.mockResolvedValue(null);
  mocks.findNotes.mockResolvedValue([]);
  mocks.findBookmarks.mockResolvedValue([]);
  mocks.upsertProgress.mockResolvedValue({});
  mocks.createNote.mockResolvedValue({});
  mocks.createTask.mockResolvedValue({ id: "task-1" });
});

describe("reading requires an entitlement", () => {
  it("refuses to open reading state without one", async () => {
    mocks.checkEntitlement.mockResolvedValue({
      allowed: false,
      reason: "NO_ENTITLEMENT",
    });
    await expect(getReadingState("u1", "alice")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("refuses to save progress without one", async () => {
    mocks.checkEntitlement.mockResolvedValue({
      allowed: false,
      reason: "NO_ENTITLEMENT",
    });
    await expect(
      saveReadingProgress({
        userId: "u1",
        slug: "alice",
        locator: "epubcfi(/6/4!/4/2)",
        percentage: 10,
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.upsertProgress).not.toHaveBeenCalled();
  });

  it("refuses to annotate without one", async () => {
    mocks.checkEntitlement.mockResolvedValue({
      allowed: false,
      reason: "EXPIRED",
    });
    await expect(
      createAnnotation({
        userId: "u1",
        slug: "alice",
        locator: "epubcfi(/6/4!/4/2)",
        selectedText: "Down, down, down.",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.createNote).not.toHaveBeenCalled();
  });

  it("404s on a title that does not exist", async () => {
    mocks.findEssential.mockResolvedValue(null);
    await expect(getReadingState("u1", "nope")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("annotations belong to one member", () => {
  it("scopes an update by user id rather than trusting the note id", async () => {
    mocks.updateManyNote.mockResolvedValue({ count: 1 });
    await updateAnnotation({ userId: "u1", noteId: "n1", body: "mine" });
    expect(mocks.updateManyNote.mock.calls[0][0].where).toEqual({
      id: "n1",
      userId: "u1",
    });
  });

  it("reports another member's note as not found rather than editing it", async () => {
    mocks.updateManyNote.mockResolvedValue({ count: 0 });
    await expect(
      updateAnnotation({ userId: "u2", noteId: "n1", body: "not mine" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("scopes a delete the same way", async () => {
    mocks.deleteManyNote.mockResolvedValue({ count: 0 });
    await expect(deleteAnnotation("u2", "n1")).rejects.toMatchObject({
      status: 404,
    });
    expect(mocks.deleteManyNote.mock.calls[0][0].where).toEqual({
      id: "n1",
      userId: "u2",
    });
  });
});

describe("progress values", () => {
  it("clamps a percentage the client got wrong", async () => {
    await saveReadingProgress({
      userId: "u1",
      slug: "alice",
      locator: "epubcfi(/6/4!/4/2)",
      percentage: 148.7,
    });
    expect(mocks.upsertProgress.mock.calls[0][0].update.percentage).toBe(100);

    vi.clearAllMocks();
    mocks.findEssential.mockResolvedValue(title);
    mocks.checkEntitlement.mockResolvedValue({
      allowed: true,
      reason: "ENTITLED",
    });
    mocks.upsertProgress.mockResolvedValue({});
    await saveReadingProgress({
      userId: "u1",
      slug: "alice",
      locator: "epubcfi(/6/4!/4/2)",
      percentage: -30,
    });
    expect(mocks.upsertProgress.mock.calls[0][0].update.percentage).toBe(0);
  });
});

describe("empty annotations", () => {
  it("refuses a highlight with neither text nor a note", async () => {
    await expect(
      createAnnotation({
        userId: "u1",
        slug: "alice",
        locator: "epubcfi(/6/4!/4/2)",
        selectedText: "   ",
        body: "",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

/**
 * An unknown percentage is not zero.
 *
 * epub.js can report where the reader is long before it can say how far
 * through that is: the location index is built after the book is on screen,
 * and `percentageFromCfi` answers 0 until it exists. Every reopen therefore
 * produces one position with no usable percentage, and writing a zero for it
 * would tell a member halfway through a book that they had not started it.
 */
describe("progress with no percentage yet", () => {
  it("saves the position without touching the stored percentage", async () => {
    await saveReadingProgress({
      userId: "u1",
      slug: "alice",
      locator: "epubcfi(/6/10!/4/2)",
    });
    const call = mocks.upsertProgress.mock.calls[0][0];
    expect(call.update.locator).toBe("epubcfi(/6/10!/4/2)");
    expect(call.update).not.toHaveProperty("percentage");
  });

  it("still starts a new record at zero", async () => {
    await saveReadingProgress({
      userId: "u1",
      slug: "alice",
      locator: "epubcfi(/6/10!/4/2)",
    });
    expect(mocks.upsertProgress.mock.calls[0][0].create.percentage).toBe(0);
  });
});

/**
 * A task raised from a book is a planner task.
 *
 * The point of these is that there is no second to-do system for books: the
 * row created is an ordinary `AcademicTask` owned by the member, and the note
 * is what remembers the link.
 */
describe("raising a task from a passage", () => {
  it("creates an ordinary planner task and links the note to it", async () => {
    await createAnnotation({
      userId: "u1",
      slug: "alice",
      locator: "epubcfi(/6/10!/4/2)",
      selectedText: "They were indeed a queer-looking party.",
      chapterLabel: "CHAPTER III. A Caucus-Race and a Long Tale",
      task: { title: "Revise the Caucus-Race" },
    });

    const task = mocks.createTask.mock.calls[0][0].data;
    expect(task.ownerId).toBe("u1");
    expect(task.title).toBe("Revise the Caucus-Race");
    // The passage travels with it: "re-read this" means nothing in a planner
    // that cannot show what "this" was.
    expect(task.description).toContain("queer-looking party");
    expect(task.description).toContain("A Caucus-Race");

    const note = mocks.createNote.mock.calls[0][0].data;
    expect(note.taskId).toBe("task-1");
    expect(note.chapterLabel).toBe(
      "CHAPTER III. A Caucus-Race and a Long Tale",
    );
  });

  it("raises no task when none was asked for", async () => {
    await createAnnotation({
      userId: "u1",
      slug: "alice",
      locator: "epubcfi(/6/10!/4/2)",
      selectedText: "A passage.",
    });
    expect(mocks.createTask).not.toHaveBeenCalled();
    expect(mocks.createNote.mock.calls[0][0].data.taskId).toBeNull();
  });

  it("refuses to write an entitlement-less task", async () => {
    mocks.checkEntitlement.mockResolvedValue({
      allowed: false,
      reason: "NO_ENTITLEMENT",
    });
    await expect(
      createAnnotation({
        userId: "u1",
        slug: "alice",
        locator: "epubcfi(/6/10!/4/2)",
        selectedText: "A passage.",
        task: { title: "Not mine to raise" },
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.createTask).not.toHaveBeenCalled();
  });
});
