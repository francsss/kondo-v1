import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What "owns" means, and where a title opens.
 *
 * Both questions used to be answered independently by each surface, and the
 * catalogue got both wrong: it asked only about paid orders, so a member
 * reading a book on an entitlement was offered "Buy this", and a free title
 * — which transacts nothing and therefore has no row anywhere — was offered a
 * checkout for nothing. It also sent every digital title to the chapter
 * reader, EPUBs included, which have no chapters and would have opened empty.
 */

const mocks = vi.hoisted(() => ({
  findOrder: vi.fn(),
  checkEntitlement: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    studyEssentialOrder: { findFirst: mocks.findOrder },
    studyEssential: { findMany: vi.fn() },
    studyEntitlement: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/study-entitlements", () => ({
  checkEntitlement: mocks.checkEntitlement,
  listEntitledEssentials: vi.fn(),
}));

vi.mock("@/lib/study-workspace", () => ({ listLibrary: vi.fn() }));

import { isReadable, openHref, ownsEssential } from "@/lib/study-library";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findOrder.mockResolvedValue(null);
  mocks.checkEntitlement.mockResolvedValue({
    allowed: false,
    reason: "NO_ENTITLEMENT",
  });
});

describe("where a title opens", () => {
  it("sends an EPUB to the reader that can open a file", () => {
    expect(
      openHref({ slug: "alice", deliveryType: "EPUB", chapterCount: 0 }),
    ).toBe("/student-hub/books/alice");
  });

  it("sends a title stored as chapters to the chapter reader", () => {
    expect(
      openHref({ slug: "hsk", deliveryType: "TEXT", chapterCount: 5 }),
    ).toBe("/student-hub/essentials/read/hsk");
  });

  it("sends anything unreadable to its own page rather than a reader", () => {
    expect(
      openHref({ slug: "notebook", deliveryType: "TEXT", chapterCount: 0 }),
    ).toBe("/student-hub/essentials/notebook");
  });

  it("counts an EPUB as readable even though it has no chapter rows", () => {
    // The shelf used to require chapters, so a real book was never readable.
    expect(
      isReadable({ slug: "alice", deliveryType: "EPUB", chapterCount: 0 }),
    ).toBe(true);
    expect(
      isReadable({ slug: "kit", deliveryType: "TEXT", chapterCount: 0 }),
    ).toBe(false);
  });
});

describe("who owns a title", () => {
  it("counts a paid order", async () => {
    mocks.findOrder.mockResolvedValue({ id: "order-1" });
    expect(await ownsEssential("u1", "e1")).toBe(true);
  });

  it("counts an entitlement, which orders alone would miss", async () => {
    mocks.checkEntitlement.mockResolvedValue({
      allowed: true,
      reason: "ENTITLED",
    });
    expect(await ownsEssential("u1", "e1")).toBe(true);
  });

  it("counts a free title, which has no row of either kind", async () => {
    mocks.checkEntitlement.mockResolvedValue({ allowed: true, reason: "FREE" });
    expect(await ownsEssential("u1", "e1")).toBe(true);
  });

  it("is false when the member has none of the three", async () => {
    expect(await ownsEssential("u1", "e1")).toBe(false);
  });

  it("does not treat an expired entitlement as ownership", async () => {
    mocks.checkEntitlement.mockResolvedValue({
      allowed: false,
      reason: "EXPIRED",
    });
    expect(await ownsEssential("u1", "e1")).toBe(false);
  });
});
