import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The selection toolbar has to be readable, and has to be somewhere you can
 * reach it.
 *
 * Both failures came from the same place: the reader has a theme of its own.
 * `READER_THEMES[theme].shell` sets a text colour belonging to the *book* —
 * cream on dark paper, near-black on light — while the popovers drew
 * themselves on `bg-card`, which follows the *app* theme. The two are
 * independent axes, so a book read on dark paper in a light app produced cream
 * labels on a white surface: the actions were there, and invisible. Pairing
 * the surface with `text-card-foreground` made them legible but left a bright
 * white slab lying across a book being read at night — the one thing the dark
 * paper exists to avoid. Anything drawn *over the page* belongs to the page,
 * so those popovers take the reading theme's own surface, foreground, border
 * and hover, and the app theme does not reach into them at all.
 *
 * The position was pinned to the bottom of the layout viewport, which on a
 * phone runs underneath the browser's own chrome and, with a keyboard up,
 * underneath that too. It is measured against `visualViewport` now and placed
 * against the passage instead.
 */

const source = readFileSync(
  resolve("src/components/features/student-hub/BookReader.tsx"),
  "utf8",
);

/**
 * The named function's own code — bounded to its body so a neighbour's classes
 * cannot leak in, and stripped of comments so the prose explaining what these
 * used to do is not mistaken for what they still do.
 */
function surfaces(component: string) {
  const start = source.indexOf(component);
  expect(start).toBeGreaterThan(-1);
  const rest = source.slice(start);
  const end = rest.indexOf("\n}\n");
  return rest
    .slice(0, end === -1 ? rest.length : end)
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/\/\/.*$/gm, "");
}

const themes = readFileSync(resolve("src/lib/reader-theme.ts"), "utf8");

describe("the popovers over the page follow the book's theme", () => {
  it.each([
    ["function SelectionBar", "the selection toolbar"],
    ["function ReaderPanel", "the contents, marks and type panel"],
  ])("%s draws on READER_THEMES[theme].surface", (component) => {
    const body = surfaces(component);
    expect(body).toContain("READER_THEMES[theme].surface");
    // `bg-card` follows the app theme, which is the other axis entirely.
    expect(body).not.toContain("bg-card");
    expect(body).not.toContain("text-card-foreground");
  });

  it("carries no app-theme foreground into either", () => {
    for (const component of ["function SelectionBar", "function ReaderPanel"]) {
      const body = surfaces(component);
      expect(body).not.toContain("text-muted-foreground");
      expect(body).not.toContain("hover:bg-muted");
      expect(body).not.toContain("border-border");
    }
  });

  it("gives every reading theme its own surface, foreground and border", () => {
    for (const theme of ["light", "sepia", "dark"]) {
      const entry = themes.slice(themes.indexOf(`  ${theme}: {`));
      const block = entry.slice(0, entry.indexOf("\n  },"));
      expect(block).toContain("surface:");
      expect(block).toContain("muted:");
      expect(block).toContain("hover:");
      expect(block).toContain("line:");
    }
  });

  it("keeps the modal sheet on app colours, paired with its own foreground", () => {
    // The note and task sheets are dialogs behind a scrim, full of app-themed
    // form controls; they are app surfaces and stay that way. What they must
    // not do is take `bg-card` while inheriting the book's text colour.
    const sheet = surfaces("function Sheet");
    const card = sheet.indexOf("bg-card");
    expect(card).toBeGreaterThan(-1);
    expect(sheet.slice(card, card + 200)).toContain("text-card-foreground");
  });

  it("does not hardcode a colour that ignores the reading theme", () => {
    const bar = surfaces("function SelectionBar");
    expect(bar).not.toMatch(/bg-white\b/);
    expect(bar).not.toMatch(/text-black\b/);
    expect(bar).not.toMatch(/bg-\[#/);
  });
});

describe("the selection toolbar stays on screen", () => {
  it("measures the visible viewport, not the layout one", () => {
    const bar = surfaces("function SelectionBar");
    expect(bar).toContain("window.visualViewport");
    // The keyboard and the browser's chrome both change it while open.
    expect(bar).toContain('addEventListener("resize", place)');
    expect(bar).toContain('addEventListener("scroll", place)');
  });

  it("places itself against the passage rather than always at the bottom", () => {
    expect(source).toContain("type SelectionAnchor");
    expect(source).toContain("anchor: anchorFor(selected)");
    const bar = surfaces("function SelectionBar");
    expect(bar).toContain("anchor.top - GAP - height");
    expect(bar).toContain("anchor.bottom + GAP");
  });

  it("clamps to the visible area so it cannot be pushed off an edge", () => {
    const bar = surfaces("function SelectionBar");
    expect(bar).toContain("Math.min(Math.max(next, highest), lowest)");
  });

  it("spans the width rather than sizing to its labels", () => {
    // A content-sized row put "AI" and the dismiss past the right-hand edge.
    const bar = surfaces("function SelectionBar");
    expect(bar).toContain("inset-x-3");
    expect(bar).not.toContain("overflow-x");
  });

  it("maps the selection out of the iframe before using it", () => {
    // A rect measured inside epub.js's iframe is in the iframe's coordinates;
    // the toolbar is not in the iframe.
    expect(source).toContain("frameBox.top + box.top");
    expect(source).toContain("frameBox.top + box.bottom");
  });
});
