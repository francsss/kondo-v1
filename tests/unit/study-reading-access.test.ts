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
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
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
  },
}));

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
