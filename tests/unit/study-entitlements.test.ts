import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Who may open a book.
 *
 * Every protected surface defers to `checkEntitlement`, so these cases are the
 * definition of access for the reader, the file, the notes and the assistant
 * alike. The ones that matter most are the refusals.
 */

const mocks = vi.hoisted(() => ({
  findEssential: vi.fn(),
  findEntitlement: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    studyEssential: { findUnique: mocks.findEssential },
    studyEntitlement: { findUnique: mocks.findEntitlement },
    studyReadingProgress: { findMany: vi.fn() },
  },
}));

import { checkEntitlement, isFreeTitle } from "@/lib/study-entitlements";

const paidTitle = {
  id: "book-1",
  status: "PUBLISHED",
  priceMinor: 990,
  source: "KONDO",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findEssential.mockResolvedValue(paidTitle);
  mocks.findEntitlement.mockResolvedValue(null);
});

describe("entitlement checks", () => {
  it("denies a member with no entitlement to a paid title", async () => {
    const result = await checkEntitlement({
      userId: "u1",
      essentialId: "book-1",
    });
    expect(result).toEqual({ allowed: false, reason: "NO_ENTITLEMENT" });
  });

  it("allows a member holding an active entitlement", async () => {
    mocks.findEntitlement.mockResolvedValue({
      status: "ACTIVE",
      expiresAt: null,
    });
    const result = await checkEntitlement({
      userId: "u1",
      essentialId: "book-1",
    });
    expect(result).toEqual({ allowed: true, reason: "ENTITLED" });
  });

  it("denies an entitlement whose expiry has passed", async () => {
    mocks.findEntitlement.mockResolvedValue({
      status: "ACTIVE",
      expiresAt: new Date("2020-01-01"),
    });
    const result = await checkEntitlement({
      userId: "u1",
      essentialId: "book-1",
    });
    expect(result).toEqual({ allowed: false, reason: "EXPIRED" });
  });

  it("denies a revoked entitlement even on a free title", async () => {
    // Revocation is deliberate. A later price change to zero must not quietly
    // hand the book back.
    mocks.findEssential.mockResolvedValue({ ...paidTitle, priceMinor: 0 });
    mocks.findEntitlement.mockResolvedValue({
      status: "REVOKED",
      expiresAt: null,
    });
    const result = await checkEntitlement({
      userId: "u1",
      essentialId: "book-1",
    });
    expect(result).toEqual({ allowed: false, reason: "NO_ENTITLEMENT" });
  });

  it("denies access to a title that is not published, even to an owner", async () => {
    mocks.findEssential.mockResolvedValue({ ...paidTitle, status: "ARCHIVED" });
    mocks.findEntitlement.mockResolvedValue({
      status: "ACTIVE",
      expiresAt: null,
    });
    const result = await checkEntitlement({
      userId: "u1",
      essentialId: "book-1",
    });
    expect(result).toEqual({ allowed: false, reason: "UNAVAILABLE" });
  });

  it("denies access to a title that does not exist", async () => {
    mocks.findEssential.mockResolvedValue(null);
    const result = await checkEntitlement({
      userId: "u1",
      essentialId: "nope",
    });
    expect(result).toEqual({ allowed: false, reason: "UNAVAILABLE" });
  });

  it("allows a free Kondo title without an entitlement", async () => {
    mocks.findEssential.mockResolvedValue({ ...paidTitle, priceMinor: 0 });
    const result = await checkEntitlement({
      userId: "u1",
      essentialId: "book-1",
    });
    expect(result).toEqual({ allowed: true, reason: "FREE" });
  });
});

describe("free titles", () => {
  it("is only free when Kondo publishes it at no cost", () => {
    expect(isFreeTitle({ priceMinor: 0, source: "KONDO" })).toBe(true);
    expect(isFreeTitle({ priceMinor: null, source: "KONDO" })).toBe(true);
    expect(isFreeTitle({ priceMinor: 990, source: "KONDO" })).toBe(false);
    // A partner's free listing still lives on the partner's platform.
    expect(isFreeTitle({ priceMinor: 0, source: "PARTNER" })).toBe(false);
  });
});
