/**
 * Import an EPUB into Kondo as a readable title.
 *
 *   npx tsx scripts/import-book-epub.ts <file.epub> --slug alice-in-wonderland \
 *     --title "Alice's Adventures in Wonderland" --author "Lewis Carroll" \
 *     [--price 990] [--ai-allowed] [--publish]
 *
 * The file goes into Kondo's private object storage — the same bucket every
 * other private asset uses — and never into `public/`. Nothing about the
 * uploaded object is reachable without an entitlement and a signed URL.
 *
 * Rights default to nothing. `--ai-allowed` is opt-in per title because a
 * licence that permits reading may still forbid machine processing, and the
 * safe default for a book whose terms nobody has checked is "no".
 *
 * Only supply files Kondo has the right to distribute: a public-domain work,
 * an openly licensed one, or a title a publisher has licensed to you. This
 * script deliberately takes a local path and never downloads from the web.
 */
import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import { PrismaClient } from "@prisma/client";
import { getObjectStorage } from "../src/lib/storage";

const prisma = new PrismaClient();

export type ImportedBook = {
  slug: string;
  status: string;
  priceMinor: number | null;
  objectKey: string;
  bytes: number;
  aiAllowed: boolean;
};

type Options = {
  file: string;
  slug: string;
  title: string;
  author?: string;
  priceMinor: number;
  aiAllowed: boolean;
  publish: boolean;
  language: string;
};

function parseArgs(argv: string[]): Options {
  const [file] = argv.filter((arg) => !arg.startsWith("--"));
  const flag = (name: string) => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const has = (name: string) => argv.includes(`--${name}`);

  if (!file) throw new Error("Give the path to an .epub file.");
  const slug = flag("slug");
  const title = flag("title");
  if (!slug || !title) throw new Error("--slug and --title are required.");

  return {
    file,
    slug,
    title,
    author: flag("author"),
    priceMinor: Number(flag("price") ?? "0"),
    aiAllowed: has("ai-allowed"),
    publish: has("publish"),
    language: flag("language") ?? "en",
  };
}

/**
 * Put an EPUB into storage and the catalogue.
 *
 * Takes bytes rather than a path so that seeding and the end-to-end suite can
 * import a generated book without writing a temporary file first, and so that
 * there is one implementation of "a book exists now" rather than one per
 * caller.
 */
export async function importBookEpub(input: {
  bytes: Uint8Array;
  fileName: string;
  slug: string;
  title: string;
  author?: string | null;
  priceMinor?: number;
  aiAllowed?: boolean;
  publish?: boolean;
  language?: string;
  client?: PrismaClient;
}): Promise<ImportedBook> {
  const db = input.client ?? prisma;
  const language = input.language ?? "en";
  const priceMinor = input.priceMinor ?? 0;
  const aiAllowed = input.aiAllowed ?? false;
  const publish = input.publish ?? false;

  // Namespaced and slugged, so two titles cannot collide and the key says what
  // it is when someone is looking at a bucket listing.
  const objectKey = `books/${input.slug}/${basename(input.fileName)}`;
  const storage = getObjectStorage();
  // Replacing the file is the point of re-running an import — a corrected
  // edition, or a re-seeded fixture — so this asks for the overwrite.
  await storage.write(objectKey, input.bytes, "application/epub+zip", {
    overwrite: true,
  });

  const essential = await db.studyEssential.upsert({
    where: { slug: input.slug },
    update: {
      title: input.title,
      author: input.author ?? null,
      language,
      deliveryType: "EPUB",
      assetKey: objectKey,
      assetContentType: "application/epub+zip",
      assetBytes: input.bytes.byteLength,
      aiAllowed,
      priceMinor,
      status: publish ? "PUBLISHED" : "DRAFT",
      publishedAt: publish ? new Date() : null,
    },
    create: {
      slug: input.slug,
      title: input.title,
      author: input.author ?? null,
      language,
      shortDescription: `${input.title}${input.author ? ` by ${input.author}` : ""}.`,
      description: `${input.title}${input.author ? ` by ${input.author}` : ""}, read in Kondo.`,
      category: "Reading",
      format: "DIGITAL",
      source: "KONDO",
      status: publish ? "PUBLISHED" : "DRAFT",
      publishedAt: publish ? new Date() : null,
      priceMinor,
      currency: "CNY",
      coverEmoji: "📖",
      deliveryType: "EPUB",
      assetKey: objectKey,
      assetContentType: "application/epub+zip",
      assetBytes: input.bytes.byteLength,
      aiAllowed,
      // The other three rights stay false. Reading is what was asked for.
      copyAllowed: false,
      downloadAllowed: false,
      printAllowed: false,
    },
    select: { slug: true, status: true, priceMinor: true },
  });

  return {
    slug: essential.slug,
    status: essential.status,
    priceMinor: essential.priceMinor,
    objectKey,
    bytes: input.bytes.byteLength,
    aiAllowed,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.file.toLowerCase().endsWith(".epub")) {
    throw new Error("That is not an .epub file.");
  }
  await stat(options.file);
  const bytes = await readFile(options.file);

  const imported = await importBookEpub({
    bytes,
    fileName: options.file,
    slug: options.slug,
    title: options.title,
    author: options.author,
    priceMinor: options.priceMinor,
    aiAllowed: options.aiAllowed,
    publish: options.publish,
    language: options.language,
  });
  console.log(
    JSON.stringify({ imported: imported.slug, ...imported }, null, 2),
  );
}

// Only when invoked as a command. Seeding imports `importBookEpub` from this
// module, and an unguarded `main()` ran the argument parser against the
// seed's own argv — printing a usage error and leaving a successful seed with
// a failing exit code.
if (process.argv[1]?.includes("import-book-epub")) {
  void main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
