import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Where the reader is told to fetch a book from.
 *
 * This looked correct in every development environment and failed in
 * production only. The local storage driver issues no signed URL, so
 * development always took the same-origin path; production presigns, and the
 * browser was handed a `https://<bucket>...` URL belonging to someone else's
 * origin. A presigned URL carries no `Access-Control-Allow-Origin` unless the
 * bucket has been given a CORS policy, and the reader asked for it with
 * `credentials: "include"`, which makes even a wildcard policy invalid. The
 * request never reached the bucket, and what surfaced was
 * `TypeError: Failed to fetch` — no status, no server log, nothing to read.
 *
 * The URL is Kondo's own now whatever the driver does, so these mock a driver
 * that *does* presign: that is the case that was broken, and the only one a
 * local run would never exercise.
 */

const mocks = vi.hoisted(() => ({
  findEssential: vi.fn(),
  checkEntitlement: vi.fn(),
  createReadTarget: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { studyEssential: { findUnique: mocks.findEssential } },
}));

vi.mock("@/lib/study-entitlements", () => ({
  checkEntitlement: mocks.checkEntitlement,
}));

vi.mock("@/lib/storage", () => ({
  getObjectStorage: () => ({ createReadTarget: mocks.createReadTarget }),
}));

import { createStudyAssetAccess } from "@/lib/study-asset-access";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findEssential.mockResolvedValue({
    id: "book-1",
    title: "A Sample Book for the Kondo Reader",
    status: "PUBLISHED",
    deliveryType: "EPUB",
    assetKey: "books/sample/sample.epub",
    assetContentType: "application/epub+zip",
  });
  mocks.checkEntitlement.mockResolvedValue({ allowed: true, reason: "FREE" });
  mocks.createReadTarget.mockResolvedValue(null);
});

describe("the reader always fetches from Kondo's own origin", () => {
  it("does not hand over a presigned storage URL", async () => {
    // Exactly what S3 and R2 return, and what used to be sent to the browser.
    mocks.createReadTarget.mockResolvedValue({
      url: "https://account.r2.cloudflarestorage.com/kondo/books/sample/sample.epub?X-Amz-Signature=abc",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    });

    const access = await createStudyAssetAccess({
      userId: "u1",
      slug: "kondo-sample-book",
    });

    expect(access.url).toBe("/api/study/books/kondo-sample-book/file");
    expect(access.url.startsWith("/")).toBe(true);
    expect(access.url).not.toContain("cloudflarestorage");
    expect(access.url).not.toContain("X-Amz-Signature");
  });

  it("returns the same URL when the driver issues no signed URL", async () => {
    const access = await createStudyAssetAccess({
      userId: "u1",
      slug: "kondo-sample-book",
    });
    expect(access.url).toBe("/api/study/books/kondo-sample-book/file");
  });

  it("never puts the storage key in what the browser receives", async () => {
    const access = await createStudyAssetAccess({
      userId: "u1",
      slug: "kondo-sample-book",
    });
    expect(JSON.stringify(access)).not.toContain("books/sample/sample.epub");
  });
});

describe("access is still refused where it should be", () => {
  it("refuses a member without an entitlement", async () => {
    mocks.checkEntitlement.mockResolvedValue({
      allowed: false,
      reason: "NO_ENTITLEMENT",
    });
    await expect(
      createStudyAssetAccess({ userId: "u1", slug: "kondo-sample-book" }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("refuses a title that is not published", async () => {
    mocks.findEssential.mockResolvedValue({
      id: "book-1",
      title: "Draft",
      status: "DRAFT",
      deliveryType: "EPUB",
      assetKey: "books/x/x.epub",
      assetContentType: "application/epub+zip",
    });
    await expect(
      createStudyAssetAccess({ userId: "u1", slug: "draft" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("says so plainly when a title has no file yet", async () => {
    mocks.findEssential.mockResolvedValue({
      id: "book-1",
      title: "No file",
      status: "PUBLISHED",
      deliveryType: "EPUB",
      assetKey: null,
      assetContentType: null,
    });
    await expect(
      createStudyAssetAccess({ userId: "u1", slug: "no-file" }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
