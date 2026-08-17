/**
 * Turning a position in an EPUB into the name of the chapter it is in.
 *
 * This is separate from the reader component because it is the piece most
 * worth testing on its own: it is pure, it is where a real book breaks it, and
 * the failure mode is silent. A table of contents points at a position inside
 * a document — Project Gutenberg's converter writes every entry as
 * `chapter.xhtml#pgepubid00005` — while the renderer reports the document it
 * is showing. Compared as written, the two never match, so looking a chapter
 * up by href returns nothing for a large share of real books. Nothing throws;
 * the chapter name is simply absent, and so is the chapter recorded on every
 * highlight, note, bookmark and planner task taken while reading it.
 */

export type TocEntry = {
  label?: string;
  href?: string;
  subitems?: TocEntry[];
};

/**
 * The document a table-of-contents entry points at, without the anchor.
 *
 * The directory is dropped as well: an OPF may spell the same file as
 * `chapter.xhtml` in one place and `OEBPS/chapter.xhtml` or `../Text/chapter.xhtml`
 * in another, and those are the same chapter.
 */
export function documentPath(href: string) {
  return href.split("#")[0].split("/").pop() ?? href;
}

/**
 * Flatten a table of contents — nested parts included — into document → label.
 *
 * The first entry for a document wins. A chapter whose subheadings each carry
 * their own anchor should read as its chapter, not as whichever subheading
 * came last in the file.
 */
export function chapterIndex(
  items: TocEntry[],
  into = new Map<string, string>(),
) {
  for (const item of items) {
    const label = String(item.label ?? "").trim();
    const href = String(item.href ?? "");
    if (href && label && !into.has(documentPath(href))) {
      into.set(documentPath(href), label);
    }
    if (item.subitems?.length) chapterIndex(item.subitems, into);
  }
  return into;
}
