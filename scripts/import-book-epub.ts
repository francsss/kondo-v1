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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.file.toLowerCase().endsWith(".epub")) {
    throw new Error("That is not an .epub file.");
  }
  const info = await stat(options.file);
  const bytes = await readFile(options.file);

  // Namespaced and slugged, so two titles cannot collide and the key says what
  // it is when someone is looking at a bucket listing.
  const objectKey = `books/${options.slug}/${basename(options.file)}`;
  const storage = getObjectStorage();
  // Replacing the file is the point of re-running an import — a corrected
  // edition, or a re-imported fixture — so this asks for the overwrite.
  await storage.write(objectKey, bytes, "application/epub+zip", {
    overwrite: true,
  });

  const essential = await prisma.studyEssential.upsert({
    where: { slug: options.slug },
    update: {
      title: options.title,
      author: options.author ?? null,
      language: options.language,
      deliveryType: "EPUB",
      assetKey: objectKey,
      assetContentType: "application/epub+zip",
      assetBytes: info.size,
      aiAllowed: options.aiAllowed,
      priceMinor: options.priceMinor,
      status: options.publish ? "PUBLISHED" : "DRAFT",
      publishedAt: options.publish ? new Date() : null,
    },
    create: {
      slug: options.slug,
      title: options.title,
      author: options.author ?? null,
      language: options.language,
      shortDescription: `${options.title}${options.author ? ` by ${options.author}` : ""}.`,
      description: `${options.title}${options.author ? ` by ${options.author}` : ""}, read in Kondo.`,
      category: "Reading",
      format: "DIGITAL",
      source: "KONDO",
      status: options.publish ? "PUBLISHED" : "DRAFT",
      publishedAt: options.publish ? new Date() : null,
      priceMinor: options.priceMinor,
      currency: "CNY",
      coverEmoji: "📖",
      deliveryType: "EPUB",
      assetKey: objectKey,
      assetContentType: "application/epub+zip",
      assetBytes: info.size,
      aiAllowed: options.aiAllowed,
      // The other three rights stay false. Reading is what was asked for.
      copyAllowed: false,
      downloadAllowed: false,
      printAllowed: false,
    },
    select: { id: true, slug: true, status: true, priceMinor: true },
  });

  console.log(
    JSON.stringify(
      {
        imported: essential.slug,
        status: essential.status,
        priceMinor: essential.priceMinor,
        objectKey,
        bytes: info.size,
        aiAllowed: options.aiAllowed,
      },
      null,
      2,
    ),
  );
}

void main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
