import { expect, test, type Page } from "@playwright/test";
import { FIXTURE_SLUG } from "./books-fixture";

/**
 * The reader, on a phone, against real EPUB files.
 *
 * Every check here exists because a real book broke something a hand-written
 * fixture did not. Project Gutenberg's Alice opens on an SVG-only cover page,
 * links three of its own stylesheets, and writes every table-of-contents entry
 * as `document.xhtml#anchor` — and each of those found a separate defect: a
 * cover that rendered nothing measurable, stylesheets refused by CSP, and a
 * chapter name that never resolved, which in turn left every highlight, note
 * and planner task with no record of where it came from.
 *
 * Two books are read here, because the defects divide in two. Most of them are
 * true of any EPUB — chrome sitting over the controls, a toolbar wider than
 * the phone, progress erased on reopen — and those run against a fixture this
 * repository can build, so they are guarded on every CI run. The rest need
 * that specific Gutenberg file, which is not in git and never will be, and
 * they say so when it is absent instead of quietly passing.
 */

const ALICE = {
  slug: "alice-in-wonderland",
  name: "Alice's Adventures in Wonderland",
  chapter: "CHAPTER III. A Caucus-Race and a Long Tale",
  inChapter: /Caucus-Race/i,
};

const FIXTURE = {
  slug: FIXTURE_SLUG,
  name: "the Kondo sample book",
  chapter: "Why positions are not page numbers",
  inChapter: /reflows/i,
};

type Title = typeof ALICE;

test.use({ viewport: { width: 390, height: 844 } });

// These do real work in a real reader: unzip an archive in the browser, render
// a chapter, index it for percentages. The suite default of 30s is a budget
// for a page load, not for that.
test.describe.configure({ timeout: 120_000 });

const readerFor = (title: Title) => `/student-hub/books/${title.slug}`;

/**
 * The rendered book, whichever frame epub.js is currently using for it.
 *
 * epub.js creates and swaps iframes as it renders sections, and after a
 * client-side navigation an old one can still be attached. Asking the page for
 * "the iframe" therefore sometimes hands back an empty document belonging to a
 * reader that is displaying the chapter perfectly well. Every frame is asked
 * instead, and the one with content answers.
 */
async function inBook<T>(page: Page, fn: () => T, fallback: T): Promise<T> {
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    try {
      const value = await frame.evaluate(fn);
      if (value !== fallback && value !== null && value !== undefined) {
        return value as T;
      }
    } catch {
      // A frame detached mid-read is not a failure; the next one answers.
    }
  }
  return fallback;
}

const bookText = (page: Page) =>
  inBook(page, () => document.body?.innerText ?? "", "");

/** Skip, with a reason, when this database has no such title. */
async function requireTitle(page: Page, title: Title) {
  const response = await page.goto(readerFor(title));
  test.skip(
    !response || response.status() >= 400 || !page.url().includes(title.slug),
    `${title.name} is not in this database.`,
  );
}

async function openReader(page: Page, title: Title, at?: string) {
  await page.goto(
    at ? `${readerFor(title)}?at=${encodeURIComponent(at)}` : readerFor(title),
  );
  await page.waitForSelector("iframe", { timeout: 30_000 });
  // The book is on screen once something in it has been laid out, whether that
  // is a paragraph of text or a cover image.
  await expect
    .poll(() => inBook(page, () => Math.round(document.body?.scrollWidth ?? 0), 0), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
}

/**
 * Open at a known chapter.
 *
 * Rendering a section is asynchronous and its cost varies with the size of the
 * chunk, so this waits for the text to actually arrive rather than assuming a
 * fixed delay — the difference between a reliable suite and a flaky one.
 */
async function goToChapter(page: Page, title: Title) {
  await openReader(page, title);
  await page.getByRole("button", { name: /contents/i }).click();
  await page.getByRole("button", { name: title.chapter }).click();
  await expect
    .poll(() => bookText(page), { timeout: 30_000 })
    .toMatch(title.inChapter);
}

/** Select the first substantial paragraph, the way a reader's finger would. */
async function selectAPassage(page: Page) {
  const text = await inBook(
    page,
    () => {
      const paragraph = Array.from(document.querySelectorAll("p")).find(
        (node) => (node.textContent ?? "").trim().length > 80,
      );
      if (!paragraph) return null;
      const range = document.createRange();
      range.selectNodeContents(paragraph);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return (paragraph.textContent ?? "").trim();
    },
    null as string | null,
  );
  expect(text, "the chapter should contain a selectable paragraph").toBeTruthy();
  await expect(
    page.getByRole("toolbar", { name: /selection actions/i }),
  ).toBeVisible();
  return text!;
}

function readingState(page: Page, title: Title) {
  return page.evaluate(async (slug) => {
    const response = await fetch(`/api/study/books/${slug}/reading`, {
      credentials: "include",
    });
    return response.ok
      ? ((await response.json()) as {
          progress: { locator?: string; percentage?: number } | null;
          notes: Array<{
            locator?: string;
            chapterLabel?: string;
            taskId?: string | null;
          }>;
        })
      : null;
  }, title.slug);
}

/*
 * True only of the Gutenberg file, which is not in this repository.
 *
 * These skip with a reason rather than pass emptily. To run them, import the
 * EPUB you have obtained from a legitimate source:
 *
 *   npm run books:import -- ./alice.epub --slug alice-in-wonderland \
 *     --title "Alice's Adventures in Wonderland" --author "Lewis Carroll" \
 *     --ai-allowed --publish
 */
test.describe("a book with a cover page and its own typography", () => {
  test.beforeEach(async ({ page }) => {
    await requireTitle(page, ALICE);
  });

  test("renders the cover image", async ({ page }) => {
    // Asked before a reader is mounted, because mounting one saves a position
    // of its own a couple of seconds later — a check made after opening would
    // eventually be answering about itself.
    const state = await readingState(page, ALICE);
    test.skip(
      Boolean(state?.progress?.locator),
      "This member has already started the book, so it resumes past the cover.",
    );
    await openReader(page, ALICE);

    // That first item is a cover wrapper holding one SVG image and no text, so
    // asking whether words appeared would pass on a blank page.
    const cover = await inBook(
      page,
      () => {
        const node = document.querySelector("svg image, img");
        if (!node) return null;
        const box = node.getBoundingClientRect();
        return { width: Math.round(box.width), height: Math.round(box.height) };
      },
      null as { width: number; height: number } | null,
    );
    expect(cover?.width ?? 0).toBeGreaterThan(100);
    expect(cover?.height ?? 0).toBeGreaterThan(100);
  });

  test("applies the book's own stylesheets", async ({ page }) => {
    await openReader(page, ALICE);

    // epub.js rewrites the book's linked CSS into blob: URLs. If the page's
    // CSP refuses them the book still renders, stripped of the typography it
    // was typeset with, and nothing anywhere reports a problem.
    const loaded = await inBook(
      page,
      () =>
        Array.from(document.styleSheets).some((sheet) => {
          if (!sheet.href?.startsWith("blob:")) return false;
          try {
            return sheet.cssRules.length > 0;
          } catch {
            return false;
          }
        }),
      false,
    );
    expect(loaded, "the book's linked stylesheets should load").toBe(true);
  });

  test("names a chapter whose contents entry carries an anchor", async ({
    page,
  }) => {
    // Gutenberg writes every entry as `document.xhtml#anchor` while the
    // renderer reports the document. Compared as written they never match, so
    // the chapter silently had no name — and neither did anything saved in it.
    await goToChapter(page, ALICE);
    await expect(page.getByRole("button", { name: /bookmark this page/i })).toBeVisible();
    await page.getByRole("button", { name: /bookmark this page/i }).click();

    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            const response = await fetch(
              "/api/study/books/alice-in-wonderland/reading",
              { credentials: "include" },
            );
            const body = await response.json();
            return body.bookmarks?.[0]?.label ?? null;
          }),
        { timeout: 15_000 },
      )
      .toBe(ALICE.chapter);
  });
});

/*
 * True of any EPUB, so run against both books.
 *
 * These are the regressions the reader shipped with, and none of them needed a
 * particular file to happen — which is exactly why they need to be guarded on
 * a file CI always has.
 */
for (const title of [FIXTURE, ALICE]) {
  test.describe(`reading ${title.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await requireTitle(page, title);
    });

    test("the reader's own controls are not buried under the hub's navigation", async ({
      page,
    }) => {
      await openReader(page, title);

      // The hub's bottom bar and pet sit exactly where the reader's controls
      // are. A visible-but-unclickable control passes every assertion but this.
      const blockedBy = await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll("button")).find(
          (node) => /contents/i.test(node.getAttribute("aria-label") ?? ""),
        );
        if (!button) return "the Contents control is missing";
        const box = button.getBoundingClientRect();
        const top = document.elementFromPoint(
          box.left + box.width / 2,
          box.top + box.height / 2,
        );
        return button.contains(top) ? null : (top?.tagName ?? "something else");
      });
      expect(blockedBy).toBeNull();
    });

    test("navigates by chapter, and comes back to the same place", async ({
      page,
    }) => {
      await goToChapter(page, title);

      // The reader debounces its writes; wait for the position to land.
      await expect
        .poll(async () => (await readingState(page, title))?.progress?.locator, {
          timeout: 20_000,
        })
        .toBeTruthy();

      await page.reload();
      await expect
        .poll(() => bookText(page), { timeout: 30_000 })
        .toMatch(title.inChapter);
    });

    test("reopening does not erase how far through you are", async ({
      page,
    }) => {
      await goToChapter(page, title);

      const percentage = async () =>
        (await readingState(page, title))?.progress?.percentage ?? 0;
      await expect.poll(percentage, { timeout: 20_000 }).toBeGreaterThan(0);
      const before = await percentage();

      // The percentage comes from an index epub.js builds after the book is on
      // screen, and it answers 0 until that exists. Reopening used to write
      // that 0 over real progress, so My Books called a half-read book
      // "Not started".
      await page.reload();
      await expect.poll(() => bookText(page), { timeout: 30_000 }).not.toBe("");
      await page.waitForTimeout(6000);
      expect(await percentage()).toBeGreaterThanOrEqual(before);
    });

    test("offers four actions on a selection, all of them on screen", async ({
      page,
    }) => {
      await goToChapter(page, title);
      await selectAPassage(page);

      const toolbar = page.getByRole("toolbar", { name: /selection actions/i });
      for (const label of ["Highlight", "Note", "Task", "AI"]) {
        await expect(
          toolbar.getByRole("button", { name: new RegExp(`^${label}$`) }),
        ).toBeVisible();
      }

      // An action past the right-hand edge is an action nobody finds. Sizing
      // to content put AI and the dismiss off screen under the production font.
      const overflows = await page.evaluate(() => {
        const bar = document.querySelector('[aria-label="Selection actions"]');
        return bar ? bar.scrollWidth > bar.clientWidth + 1 : true;
      });
      expect(overflows, "the whole toolbar should fit across a phone").toBe(
        false,
      );
    });

    test("a highlight records the chapter it came from", async ({ page }) => {
      await goToChapter(page, title);
      await selectAPassage(page);

      const toolbar = page.getByRole("toolbar", { name: /selection actions/i });
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/annotations") &&
            response.request().method() === "POST" &&
            response.status() === 201,
        ),
        toolbar.getByRole("button", { name: /^Highlight$/ }).click(),
      ]);

      const notes = (await readingState(page, title))?.notes ?? [];
      // A CFI says where precisely; the chapter is what a student reads back.
      expect(notes[0]?.locator).toBeTruthy();
      expect(notes[0]?.chapterLabel).toBe(title.chapter);
    });

    test("a task raised from a passage lands in the planner", async ({
      page,
    }) => {
      await goToChapter(page, title);
      await selectAPassage(page);

      const taskTitle = `Revise ${title.slug} ${Date.now()}`;
      const toolbar = page.getByRole("toolbar", { name: /selection actions/i });
      await toolbar.getByRole("button", { name: /^Task$/ }).click();

      const sheet = page.getByRole("dialog", { name: /add a task/i });
      await expect(sheet).toBeVisible();
      // Prefilled from the chapter, which only works if the chapter resolved.
      await expect(sheet.getByLabel("Task")).toHaveValue(
        new RegExp(title.chapter.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
      await sheet.getByLabel("Task").fill(taskTitle);
      await Promise.all([
        page.waitForResponse((response) =>
          response.url().includes("/annotations"),
        ),
        sheet.getByRole("button", { name: /add to planner/i }).click(),
      ]);

      // The whole point of reusing AcademicTask: it shows up where coursework
      // does, with no separate list of "book tasks" anywhere. The planner's
      // tabs are links carrying a `view` parameter.
      await page.goto("/student-hub/tools?view=tasks");
      await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 20_000 });
    });

    test("a note links back into the book at its own passage", async ({
      page,
    }) => {
      await goToChapter(page, title);
      await selectAPassage(page);

      const toolbar = page.getByRole("toolbar", { name: /selection actions/i });
      await Promise.all([
        page.waitForResponse((response) =>
          response.url().includes("/annotations"),
        ),
        toolbar.getByRole("button", { name: /^Highlight$/ }).click(),
      ]);

      await page.goto(`${readerFor(title)}/notes`);
      await expect(page.getByText(title.chapter).first()).toBeVisible();

      // `?at=` is how every surface links back into the book. It was generated
      // in three places and read in none, so all of them opened at the last
      // saved position instead of the passage that was tapped.
      await page
        .getByRole("link", { name: /open in the book/i })
        .first()
        .click();
      await expect
        .poll(() => bookText(page), { timeout: 30_000 })
        .toMatch(title.inChapter);
    });
  });
}
