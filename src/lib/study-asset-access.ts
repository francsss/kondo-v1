import { getObjectStorage } from "@/lib/storage";
import { prisma } from "@/lib/prisma";
import { checkEntitlement } from "@/lib/study-entitlements";
import { StudyEssentialError } from "@/lib/study-essentials";

/**
 * Handing a reader the file, without handing it to everyone.
 *
 * The EPUB lives in Kondo's private object storage, never under `/public`, and
 * its key is never sent to a browser. What a reader receives is a URL on
 * Kondo's own origin, issued only after the session and the entitlement have
 * both been checked, and re-checked on every request it makes.
 *
 * Vercel Blob was the suggested home for this. Kondo already stores every
 * other private object — media, documents, captures — in S3-compatible storage
 * behind `ObjectStorage`, with presigned reads that expire. Adding Blob would
 * mean a second storage system and a second set of credentials for the same
 * job, so this uses the one that already exists and is already configured in
 * production.
 *
 * This is access control, not DRM. Someone entitled to read a book can always
 * capture what they were shown; the goal is that someone *not* entitled cannot
 * fetch it, and that a URL scraped from the network tab is worthless tomorrow.
 */

/**
 * Short by design. Long enough for a reader to open and page through a book
 * without re-fetching, short enough that a leaked URL is stale before it can
 * be shared usefully. epub.js reads the file once into memory at open.
 */
const ACCESS_TTL_SECONDS = 10 * 60;

export type StudyAssetAccess = {
  url: string;
  expiresAt: string;
  deliveryType: "EPUB" | "PDF";
  title: string;
};

export async function createStudyAssetAccess(input: {
  userId: string;
  slug: string;
}): Promise<StudyAssetAccess> {
  const essential = await prisma.studyEssential.findUnique({
    where: { slug: input.slug },
    select: {
      id: true,
      title: true,
      status: true,
      deliveryType: true,
      assetKey: true,
      assetContentType: true,
    },
  });
  if (!essential || essential.status !== "PUBLISHED") {
    throw new StudyEssentialError("This title is not available.", 404);
  }

  // Only file-backed titles have an asset to sign. A TEXT title is read from
  // its chapters and an EXTERNAL one lives on someone else's platform, so
  // asking for a file here is a request that cannot be satisfied rather than
  // an authorization failure.
  if (essential.deliveryType !== "EPUB" && essential.deliveryType !== "PDF") {
    throw new StudyEssentialError(
      "This title is not delivered as a file.",
      409,
    );
  }
  if (!essential.assetKey) {
    throw new StudyEssentialError("This title has no file uploaded yet.", 409);
  }

  const entitlement = await checkEntitlement({
    userId: input.userId,
    essentialId: essential.id,
  });
  if (!entitlement.allowed) {
    // 403 rather than 404: the title exists and is listed in the store, so
    // pretending otherwise would only confuse someone who has just bought it
    // and is waiting for the payment to settle.
    throw new StudyEssentialError(
      entitlement.reason === "EXPIRED"
        ? "Your access to this title has expired."
        : "You do not have access to this title yet.",
      403,
    );
  }

  const expiresAt = new Date(Date.now() + ACCESS_TTL_SECONDS * 1000);

  /*
   * The reader is always handed a URL on Kondo's own origin.
   *
   * It used to receive a presigned storage URL directly, and in production
   * that is a cross-origin request the browser refuses before it reaches the
   * bucket: a presigned URL carries no `Access-Control-Allow-Origin` unless
   * the bucket has been given a CORS policy, and the reader sent
   * `credentials: "include"`, which makes even a wildcard policy invalid. The
   * failure surfaces as `TypeError: Failed to fetch` — no status, no server
   * log, nothing to read — while the same code works perfectly in development,
   * where the local driver issues no signed URL and the same-origin fallback
   * below is taken instead.
   *
   * So the fallback is the path. Streaming costs one pass through the app for
   * a file that is read once when a book opens, and buys a reader that does
   * not depend on per-environment bucket configuration, does not send Kondo's
   * session cookie to a storage vendor, and re-checks the entitlement on every
   * request rather than trusting a URL for ten minutes.
   *
   * `createReadTarget` is still exercised so a misconfigured bucket is caught
   * here, next to the code that can explain it, rather than as an opaque
   * failure inside the reader.
   */
  await getObjectStorage().createReadTarget({
    objectKey: essential.assetKey,
    contentType:
      essential.assetContentType ??
      (essential.deliveryType === "EPUB"
        ? "application/epub+zip"
        : "application/pdf"),
    // inline: the reader renders it in place. It is not offered as a download,
    // and `downloadAllowed` governs whether a download is ever offered at all.
    contentDisposition: "inline",
    expiresAt,
  });

  return {
    url: `/api/study/books/${input.slug}/file`,
    expiresAt: expiresAt.toISOString(),
    deliveryType: essential.deliveryType,
    title: essential.title,
  };
}

/**
 * The bytes themselves.
 *
 * Separate from `createStudyAssetAccess` so the entitlement check runs again
 * here rather than being inherited from whoever produced the URL. This is what
 * the reader actually fetches, so it is the check that matters.
 */
export async function readStudyAssetBytes(input: {
  userId: string;
  slug: string;
}) {
  const essential = await prisma.studyEssential.findUnique({
    where: { slug: input.slug },
    select: {
      id: true,
      status: true,
      assetKey: true,
      assetContentType: true,
      deliveryType: true,
    },
  });
  if (!essential || essential.status !== "PUBLISHED" || !essential.assetKey) {
    throw new StudyEssentialError("This title is not available.", 404);
  }

  const entitlement = await checkEntitlement({
    userId: input.userId,
    essentialId: essential.id,
  });
  if (!entitlement.allowed) {
    throw new StudyEssentialError("You do not have access to this title.", 403);
  }

  const bytes = await getObjectStorage().read(essential.assetKey);
  return {
    bytes,
    contentType: essential.assetContentType ?? "application/epub+zip",
  };
}
