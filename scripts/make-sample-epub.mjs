/**
 * Build a small, valid EPUB for development and tests.
 *
 *   node scripts/make-sample-epub.mjs [output.epub]
 *
 * The content is Kondo's own writing, not a third party's. That is deliberate:
 * this repository should not carry someone else's book, and a fixture whose
 * provenance is "downloaded from somewhere" is exactly what the books work is
 * meant to avoid. It is a real EPUB — real container, real OPF, real spine —
 * so it exercises parsing, pagination, CFIs, highlights and progress the same
 * way a purchased title would.
 *
 * For the actual pilot, import a public-domain EPUB you have obtained from a
 * legitimate source (Project Gutenberg and Standard Ebooks both publish
 * Alice's Adventures in Wonderland) with:
 *
 *   npm run books:import -- ./alice.epub --slug alice-in-wonderland \
 *     --title "Alice's Adventures in Wonderland" --author "Lewis Carroll" \
 *     --ai-allowed --publish
 */
import { writeFileSync } from "node:fs";
import JSZip from "jszip";

const OUTPUT = process.argv[2] ?? "sample-book.epub";

const CHAPTERS = [
  {
    id: "ch1",
    title: "What this file is",
    paragraphs: [
      "This is a sample EPUB written for Kondo's reader. It exists so the reading features can be developed and tested against a real EPUB file rather than a mock, without shipping anyone else's book inside the repository.",
      "Everything the reader does with a purchased title, it does with this one: it parses the container, builds a spine, paginates the text, and addresses positions with canonical fragment identifiers.",
      "Select a sentence in this paragraph and the reader should offer to highlight it, attach a note to it, or ask about it. The position it stores is a CFI range, which is why the highlight survives a change of font size.",
    ],
  },
  {
    id: "ch2",
    title: "Why positions are not page numbers",
    paragraphs: [
      "An EPUB reflows. The number of pages in a book depends on the size of the screen and the size of the type, so a page number is a statement about a particular reader on a particular day rather than a place in a text.",
      "A canonical fragment identifier addresses the document structure instead. It survives resizing, re-rendering and reopening, which is what makes it a reasonable thing to write down when someone closes a book.",
      "Scroll to the end of this chapter, close the reader, and open it again. It should return here rather than to the beginning.",
    ],
  },
  {
    id: "ch3",
    title: "Rights travel with the book",
    paragraphs: [
      "A licence that permits reading does not automatically permit copying, printing, downloading, or processing by a language model. Kondo records those four permissions separately for every title.",
      "When a title does not permit AI assistance, the Ask AI action is absent from the selection toolbar rather than shown and refused, and the endpoint behind it declines as well. A control that cannot work should not be offered.",
      "This sample grants AI assistance, so the action appears. A licensed textbook may not, and the same reader will behave differently for it.",
    ],
  },
];

const zip = new JSZip();

// `mimetype` must be first and stored uncompressed. Readers that check the
// magic bytes reject the file otherwise.
zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

zip.folder("META-INF").file(
  "container.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
);

const oebps = zip.folder("OEBPS");

for (const chapter of CHAPTERS) {
  oebps.file(
    `${chapter.id}.xhtml`,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
  <head><title>${chapter.title}</title></head>
  <body>
    <h1>${chapter.title}</h1>
    ${chapter.paragraphs.map((text) => `<p>${text}</p>`).join("\n    ")}
  </body>
</html>`,
  );
}

oebps.file(
  "content.opf",
  `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:kondo-sample-book</dc:identifier>
    <dc:title>A Sample Book for the Kondo Reader</dc:title>
    <dc:creator>Kondo</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">2026-08-17T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
${CHAPTERS.map((c) => `    <item id="${c.id}" href="${c.id}.xhtml" media-type="application/xhtml+xml"/>`).join("\n")}
  </manifest>
  <spine>
${CHAPTERS.map((c) => `    <itemref idref="${c.id}"/>`).join("\n")}
  </spine>
</package>`,
);

oebps.file(
  "nav.xhtml",
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en">
  <head><title>Contents</title></head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Contents</h1>
      <ol>
${CHAPTERS.map((c) => `        <li><a href="${c.id}.xhtml">${c.title}</a></li>`).join("\n")}
      </ol>
    </nav>
  </body>
</html>`,
);

const bytes = await zip.generateAsync({
  type: "nodebuffer",
  mimeType: "application/epub+zip",
});
writeFileSync(OUTPUT, bytes);
console.log(
  `Wrote ${OUTPUT} (${bytes.length} bytes, ${CHAPTERS.length} chapters)`,
);
