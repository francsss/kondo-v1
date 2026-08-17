import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The rules that make "Verified" mean something.
 *
 * Every guide in the library shipped as NEEDS_REVIEW because nobody had opened
 * its sources yet. These tests exist so the admin panel can never quietly
 * become a button that upgrades that claim without the work behind it: the
 * permission has to be held, a source has to exist, and withdrawing the last
 * source has to withdraw the badge with it.
 */

const mocks = vi.hoisted(() => ({
  findGuide: vi.fn(),
  updateGuide: vi.fn(),
  updateManyGuide: vi.fn(),
  findSource: vi.fn(),
  createSource: vi.fn(),
  deleteSource: vi.fn(),
  countSource: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLogWithClient: mocks.audit,
  writeAuditLog: mocks.audit,
}));

vi.mock("@/lib/media", () => ({
  attachMediaAsset: vi.fn(),
  MediaError: class MediaError extends Error {},
}));

vi.mock("@/lib/prisma", () => {
  // Built inside the factory because vi.mock is hoisted above module scope.
  const client = {
    guide: {
      findUnique: mocks.findGuide,
      update: mocks.updateGuide,
      updateMany: mocks.updateManyGuide,
    },
    guideSource: {
      findUnique: mocks.findSource,
      create: mocks.createSource,
      delete: mocks.deleteSource,
      count: mocks.countSource,
    },
  };
  return {
    prisma: {
      ...client,
      $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
        callback(client),
      ),
    },
  };
});

import {
  addGuideSource,
  GuideError,
  removeGuideSource,
  setGuideContentStatus,
} from "@/lib/guides";

const editor = { id: "user-editor", role: "ADMIN" };
const reviewer = { id: "user-reviewer", role: "SUPER_ADMIN" };

function guideRow(sources: number, contentStatus = "NEEDS_REVIEW") {
  return {
    id: "guide-1",
    title: "Residence permit",
    contentStatus,
    _count: { sources },
  };
}

const updatedRow = {
  id: "guide-1",
  contentStatus: "VERIFIED",
  lastVerifiedAt: new Date("2026-08-16T10:00:00Z"),
  reviewDueAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.audit.mockResolvedValue(undefined);
  mocks.updateGuide.mockResolvedValue(updatedRow);
});

describe("guide verification", () => {
  it("refuses to verify without the review permission", async () => {
    mocks.findGuide.mockResolvedValue(guideRow(2));
    await expect(
      setGuideContentStatus({
        actor: editor,
        guideId: "guide-1",
        status: "VERIFIED",
      }),
    ).rejects.toBeInstanceOf(GuideError);
    expect(mocks.updateGuide).not.toHaveBeenCalled();
  });

  it("refuses to verify a guide with no sources", async () => {
    mocks.findGuide.mockResolvedValue(guideRow(0));
    await expect(
      setGuideContentStatus({
        actor: reviewer,
        guideId: "guide-1",
        status: "VERIFIED",
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect(mocks.updateGuide).not.toHaveBeenCalled();
  });

  it("stamps the reviewer and the moment when it does verify", async () => {
    mocks.findGuide.mockResolvedValue(guideRow(1));
    await setGuideContentStatus({
      actor: reviewer,
      guideId: "guide-1",
      status: "VERIFIED",
    });
    const data = mocks.updateGuide.mock.calls[0][0].data;
    expect(data.contentStatus).toBe("VERIFIED");
    expect(data.lastVerifiedById).toBe(reviewer.id);
    expect(data.lastVerifiedAt).toBeInstanceOf(Date);
  });

  it("clears the verification stamp when the claim is withdrawn", async () => {
    mocks.findGuide.mockResolvedValue(guideRow(1, "VERIFIED"));
    await setGuideContentStatus({
      actor: editor,
      guideId: "guide-1",
      status: "NEEDS_REVIEW",
    });
    const data = mocks.updateGuide.mock.calls[0][0].data;
    expect(data.lastVerifiedAt).toBeNull();
    expect(data.lastVerifiedById).toBeNull();
  });

  it("lets a plain editor move the review date without touching the status", async () => {
    mocks.findGuide.mockResolvedValue(guideRow(1, "VERIFIED"));
    await setGuideContentStatus({
      actor: editor,
      guideId: "guide-1",
      reviewDueAt: new Date("2027-01-01T00:00:00Z"),
    });
    const data = mocks.updateGuide.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("contentStatus");
    // The stamp must survive, or a date edit would silently unverify a guide.
    expect(data).not.toHaveProperty("lastVerifiedAt");
    expect(data.reviewDueAt).toEqual(new Date("2027-01-01T00:00:00Z"));
  });

  it("404s on a guide that does not exist", async () => {
    mocks.findGuide.mockResolvedValue(null);
    await expect(
      setGuideContentStatus({
        actor: reviewer,
        guideId: "missing",
        status: "DRAFT",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("guide sources", () => {
  it("appends a source at the end of the existing list", async () => {
    mocks.findGuide.mockResolvedValue({ id: "guide-1" });
    mocks.countSource.mockResolvedValue(3);
    mocks.createSource.mockResolvedValue({ id: "src-4" });
    await addGuideSource({
      actor: editor,
      guideId: "guide-1",
      data: { title: "Exit and Entry Administration", url: "https://x.test/a" },
    });
    expect(mocks.createSource.mock.calls[0][0].data.sortOrder).toBe(3);
  });

  it("404s rather than tripping the foreign key on a stale guide", async () => {
    mocks.findGuide.mockResolvedValue(null);
    await expect(
      addGuideSource({
        actor: editor,
        guideId: "gone",
        data: { title: "A source", url: "https://x.test/a" },
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(mocks.createSource).not.toHaveBeenCalled();
  });

  it("demotes a verified guide when its last source is removed", async () => {
    mocks.findSource.mockResolvedValue({
      id: "src-1",
      guideId: "guide-1",
      title: "A source",
      url: "https://x.test/a",
    });
    mocks.deleteSource.mockResolvedValue({});
    mocks.countSource.mockResolvedValue(0);
    mocks.updateManyGuide.mockResolvedValue({ count: 1 });

    const result = await removeGuideSource({
      actor: editor,
      sourceId: "src-1",
    });
    expect(result.demoted).toBe(true);
    const call = mocks.updateManyGuide.mock.calls[0][0];
    expect(call.where.contentStatus).toBe("VERIFIED");
    expect(call.data.contentStatus).toBe("NEEDS_REVIEW");
    expect(call.data.lastVerifiedAt).toBeNull();
  });

  it("leaves the status alone while other sources remain", async () => {
    mocks.findSource.mockResolvedValue({
      id: "src-1",
      guideId: "guide-1",
      title: "A source",
      url: "https://x.test/a",
    });
    mocks.deleteSource.mockResolvedValue({});
    mocks.countSource.mockResolvedValue(2);

    const result = await removeGuideSource({
      actor: editor,
      sourceId: "src-1",
    });
    expect(result.demoted).toBe(false);
    expect(mocks.updateManyGuide).not.toHaveBeenCalled();
  });
});
