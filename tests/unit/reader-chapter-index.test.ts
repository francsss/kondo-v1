import { describe, expect, it } from "vitest";
import { chapterIndex, documentPath } from "@/lib/reader-chapters";

/**
 * Naming the chapter a reader is in.
 *
 * This looks trivial and is not: a table of contents points at a position
 * inside a document, while the renderer reports the document. Project
 * Gutenberg's converter gives every entry an anchor — `…-3.htm.xhtml#pgepubid00005`
 * — so comparing the two as written matches nothing at all. When it silently
 * matched nothing, the reader showed no chapter name and every highlight,
 * note, bookmark and planner task taken in the book recorded no chapter
 * either.
 */

const GUTENBERG_TOC = [
  { label: "CHAPTER I. Down the Rabbit-Hole", href: "11-h-1.htm.xhtml#pgepubid00003" },
  { label: "CHAPTER II. The Pool of Tears", href: "11-h-2.htm.xhtml#pgepubid00004" },
  {
    label: "CHAPTER III. A Caucus-Race and a Long Tale",
    href: "11-h-3.htm.xhtml#pgepubid00005",
  },
];

describe("documentPath", () => {
  it("drops the anchor a table of contents points at", () => {
    expect(documentPath("11-h-3.htm.xhtml#pgepubid00005")).toBe(
      "11-h-3.htm.xhtml",
    );
  });

  it("drops a directory prefix, so OEBPS/ and bare paths agree", () => {
    expect(documentPath("OEBPS/11-h-3.htm.xhtml")).toBe("11-h-3.htm.xhtml");
    expect(documentPath("../Text/chapter-1.xhtml#start")).toBe(
      "chapter-1.xhtml",
    );
  });

  it("leaves a plain document alone", () => {
    expect(documentPath("chapter-1.xhtml")).toBe("chapter-1.xhtml");
  });
});

describe("chapterIndex", () => {
  it("names a chapter from an anchored table-of-contents entry", () => {
    const index = chapterIndex(GUTENBERG_TOC);
    // What epub.js reports on relocation is the document, with no anchor.
    expect(index.get(documentPath("11-h-3.htm.xhtml"))).toBe(
      "CHAPTER III. A Caucus-Race and a Long Tale",
    );
  });

  it("keeps the first entry for a document rather than the last", () => {
    // A chapter whose subheadings each get an anchor should read as the
    // chapter, not as whichever subheading happened to come last.
    const index = chapterIndex([
      { label: "CHAPTER I. Down the Rabbit-Hole", href: "c1.xhtml#a" },
      { label: "A curious footnote", href: "c1.xhtml#b" },
    ]);
    expect(index.get("c1.xhtml")).toBe("CHAPTER I. Down the Rabbit-Hole");
  });

  it("reaches nested parts, which is where textbooks put their chapters", () => {
    const index = chapterIndex([
      {
        label: "Part One",
        href: "part1.xhtml",
        subitems: [
          { label: "1. Beginnings", href: "part1-c1.xhtml#top" },
          { label: "2. Middles", href: "part1-c2.xhtml#top" },
        ],
      },
    ]);
    expect(index.get("part1-c2.xhtml")).toBe("2. Middles");
  });

  it("ignores entries with no label or no href", () => {
    const index = chapterIndex([
      { label: "  ", href: "c1.xhtml" },
      { label: "Real", href: "" },
      { label: "Kept", href: "c2.xhtml" },
    ]);
    expect(index.size).toBe(1);
    expect(index.get("c2.xhtml")).toBe("Kept");
  });
});
