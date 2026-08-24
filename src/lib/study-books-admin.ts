import { importBookEpub } from "../../scripts/import-book-epub";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { buildSampleEpub } from "@/lib/sample-epub";

/**
 * Getting a book into Kondo without a terminal.
 *
 * The importer has always been a command-line script, which is fine for a
 * developer and useless everywhere else. Seeding is blocked in production, so
 * on a deployed Kondo there was no way to create a readable title at all: the
 * EPUB reader, the entitlements behind it and the whole library shipped with
 * no route by which a book could ever reach them.
 *
 * This is the same `importBookEpub` the script calls, behind the admin
 * permission that already governs Student Hub content. Nothing about the
 * storage layout, the catalogue row or the rights defaults changes.
 */

export class StudyBookError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "StudyBookError";
  }
}

/**
 * An EPUB is a zip whose first entry is an uncompressed `mimetype` file, so
 * both facts are checkable from the first few hundred bytes without unpacking
 * anything. This refuses a renamed PDF before it reaches storage.
 */
function assertLooksLikeEpub(bytes: Uint8Array) {
  const zipMagic =
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;
  if (!zipMagic) throw new StudyBookError("That file is not an EPUB.");

  const head = Buffer.from(bytes.subarray(0, 200)).toString("latin1");
  if (!head.includes("application/epub+zip")) {
    throw new StudyBookError(
      "That file is a zip, but not an EPUB: its mimetype entry is missing.",
    );
  }
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function listAdminBooks() {
  return prisma.studyEssential.findMany({
    where: { deliveryType: "EPUB" },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      author: true,
      status: true,
      priceMinor: true,
      currency: true,
      assetBytes: true,
      aiAllowed: true,
      updatedAt: true,
    },
    take: 100,
  });
}

export async function importAdminBook(input: {
  actorId: string;
  bytes: Uint8Array;
  fileName: string;
  slug: string;
  title: string;
  author?: string | null;
  priceMinor?: number;
  aiAllowed?: boolean;
  publish?: boolean;
  language?: string;
}) {
  const slug = input.slug.trim().toLowerCase();
  if (!SLUG.test(slug)) {
    throw new StudyBookError(
      "The address may contain lower-case letters, numbers and single hyphens.",
    );
  }
  if (!input.title.trim()) throw new StudyBookError("Give the book a title.");
  if (!input.bytes.byteLength) throw new StudyBookError("The file is empty.");
  if (input.bytes.byteLength > 25 * 1024 * 1024) {
    throw new StudyBookError("An EPUB may be up to 25 MB.");
  }
  assertLooksLikeEpub(input.bytes);

  const imported = await importBookEpub({
    bytes: input.bytes,
    fileName: input.fileName.toLowerCase().endsWith(".epub")
      ? input.fileName
      : `${slug}.epub`,
    slug,
    title: input.title.trim(),
    author: input.author?.trim() || null,
    priceMinor: input.priceMinor ?? 0,
    aiAllowed: input.aiAllowed ?? false,
    publish: input.publish ?? false,
    language: input.language ?? "en",
    client: prisma,
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: "STUDY_BOOK_IMPORTED",
    entityType: "StudyEssential",
    entityId: imported.slug,
    newValue: {
      slug: imported.slug,
      status: imported.status,
      bytes: imported.bytes,
      aiAllowed: imported.aiAllowed,
    },
  });
  return imported;
}

/**
 * The one-tap path.
 *
 * Kondo's own sample book, so a deployed environment can prove the reader
 * works end to end without anyone having to find a legitimately licensed EPUB
 * first. Free and published, so any member can open it immediately.
 */
export async function importSampleBook(actorId: string) {
  return importAdminBook({
    actorId,
    bytes: await buildSampleEpub(),
    fileName: "kondo-sample-book.epub",
    slug: "kondo-sample-book",
    title: "A Sample Book for the Kondo Reader",
    author: "Kondo",
    priceMinor: 0,
    aiAllowed: true,
    publish: true,
  });
}
