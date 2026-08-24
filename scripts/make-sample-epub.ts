/**
 * Write Kondo's sample EPUB to a file.
 *
 *   npx tsx scripts/make-sample-epub.ts [output.epub]
 *
 * The bytes come from `src/lib/sample-epub.ts`, which is also what seeding and
 * the end-to-end suite use — they just never need it on disk.
 *
 * For a real pilot title, import a public-domain EPUB you have obtained from a
 * legitimate source (Project Gutenberg and Standard Ebooks both publish
 * Alice's Adventures in Wonderland) with:
 *
 *   npm run books:import -- ./alice.epub --slug alice-in-wonderland \
 *     --title "Alice's Adventures in Wonderland" --author "Lewis Carroll" \
 *     --ai-allowed --publish
 */
import { writeFile } from "node:fs/promises";
import { buildSampleEpub, SAMPLE_EPUB_CHAPTERS } from "../src/lib/sample-epub";

const output = process.argv[2] ?? "sample-book.epub";

async function main() {
  const bytes = await buildSampleEpub();
  await writeFile(output, bytes);
  console.log(
    `Wrote ${output} (${bytes.length} bytes, ${SAMPLE_EPUB_CHAPTERS} chapters)`,
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
