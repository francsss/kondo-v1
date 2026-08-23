import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as setup } from "@playwright/test";
import { FIXTURE_SLUG, FIXTURE_TITLE } from "./books-fixture";

/**
 * Make sure there is an EPUB in the catalogue for the reader tests to open.
 *
 * Without this the reader suite skips itself on any database that has not had
 * a book imported by hand — which is every fresh one, including CI's. A suite
 * that silently runs nothing is worse than no suite, because it reports green.
 *
 * The fixture is Kondo's own sample book, built by the same generator and
 * imported through the same `books:import` pipeline a real title uses, so the
 * tests exercise the production path rather than a shortcut. It is free and
 * published so any signed-in member can open it, and it carries its own slug
 * rather than reusing a catalogue title's, so nothing in the store is
 * rewritten to suit the tests.
 *
 * The real Gutenberg EPUB is not in this repository and cannot be: books are
 * not stored in git. The checks that need that specific file skip when it is
 * absent and say so; everything that is true of any EPUB runs here.
 */

setup("import an EPUB for the reader tests", async () => {
  setup.setTimeout(120_000);
  const file = join(mkdtempSync(join(tmpdir(), "kondo-epub-")), "fixture.epub");

  const run = (command: string, args: string[]) =>
    execFileSync(command, args, {
      stdio: "pipe",
      env: { ...process.env, STORAGE_DRIVER: "local" },
    });

  run("node", ["scripts/make-sample-epub.mjs", file]);
  run("npx", [
    "tsx",
    "scripts/import-book-epub.ts",
    file,
    "--slug",
    FIXTURE_SLUG,
    "--title",
    FIXTURE_TITLE,
    "--author",
    "Kondo",
    "--price",
    "0",
    "--ai-allowed",
    "--publish",
  ]);
});
