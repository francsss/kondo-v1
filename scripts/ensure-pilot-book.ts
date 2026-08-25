/**
 * Make sure a deployed Kondo has a book its reader can open.
 *
 * Seeding is blocked in production, deliberately and correctly, and the
 * importer is a command line away from anyone who only has a browser. The
 * consequence was that the EPUB reader, the entitlements behind it and the
 * whole library could deploy perfectly and still have nothing to show, with no
 * way to fix that from the deployed app.
 *
 * This runs as part of the production build, after the migrations and the
 * client. It is an upsert on a fixed slug, so every deploy converges on the
 * same single row rather than accumulating books.
 *
 * The title is Kondo's own writing, free and published, so it is a real EPUB —
 * real container, real spine, real CFIs — that Kondo has every right to
 * distribute. Set `KONDO_SKIP_PILOT_BOOK=true` to leave the catalogue alone.
 *
 * It must never fail a deploy. A missing storage configuration or an
 * unreachable bucket is a reason to ship without the sample book, not a reason
 * to ship nothing, so every failure here is reported and swallowed.
 */
import { PrismaClient } from "@prisma/client";
import { importBookEpub } from "./import-book-epub";
import { buildSampleEpub } from "../src/lib/sample-epub";

const SLUG = "kondo-sample-book";

async function main() {
  if (process.env.KONDO_SKIP_PILOT_BOOK === "true") {
    console.log(
      "[books] KONDO_SKIP_PILOT_BOOK is set; leaving the catalogue alone.",
    );
    return;
  }
  if (!process.env.DATABASE_URL) {
    console.log("[books] No DATABASE_URL; skipping the pilot book.");
    return;
  }

  const prisma = new PrismaClient();
  try {
    /*
     * Only ever create this once. If an operator has since unpublished it, or
     * replaced its file with a real title through the admin page, that is a
     * decision — re-imposing the sample on every deploy would undo it.
     */
    const existing = await prisma.studyEssential.findUnique({
      where: { slug: SLUG },
      select: { slug: true, status: true },
    });
    if (existing) {
      console.log(
        `[books] ${existing.slug} already exists (${existing.status}); leaving it as it is.`,
      );
      return;
    }

    const imported = await importBookEpub({
      bytes: await buildSampleEpub(),
      fileName: "kondo-sample-book.epub",
      slug: SLUG,
      title: "A Sample Book for the Kondo Reader",
      author: "Kondo",
      priceMinor: 0,
      aiAllowed: true,
      publish: true,
      client: prisma,
    });
    console.log(
      `[books] Pilot book ready: ${imported.slug} (${imported.status}, ${imported.bytes} bytes).`,
    );
  } catch (error) {
    console.warn(
      "[books] Could not provision the pilot book; continuing the build.",
      error instanceof Error ? error.message : error,
    );
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

void main();
