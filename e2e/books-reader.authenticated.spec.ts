import { expect, test, type Page } from "@playwright/test";

/**
 * The reader, on a phone, against a real EPUB.
 *
 * Every check here exists because the real file broke something the generated
 * fixture did not. Project Gutenberg's Alice opens on an SVG-only cover page,
 * links three of its own stylesheets, and writes every table-of-contents entry
 * as `document.xhtml#anchor` — and each of those found a separate defect:
 * a cover that rendered nothing measurable, stylesheets refused by CSP, and a
 * chapter name that never resolved, which in turn left every highlight, note
 * and planner task with no record of where it came from.
 *
 * The book is expected to be present as the free pilot title. Seeding imports
 * it; if it is absent these skip rather than fail, because a missing pilot
 * title is a seeding problem and not a reader regression.
 */

const SLUG = "alice-in-wonderland";
const READER = `/student-hub/books/${SLUG}`;
const CHAPTER = "CHAPTER III. A Caucus-Race and a Long Tale";

test.use({ viewport: { width: 390, height: 844 } });

// These do real work in a real reader: unzip a 190KB archive in the browser,
// render a chapter, index it for percentages. The suite default of 30s is a
// budget for a page load, not for that.
test.describe.configure({ timeout: 120_000 });

/**
 * The rendered book, whichever frame epub.js is currently using for it.
 *
 * epub.js creates and swaps iframes as it renders sections, and after a
 * client-side navigation an old one can still be attached. Asking the page for
 * "the iframe" therefore sometimes hands back an empty document belonging to a
 * reader that is displaying the chapter perfectly well. Every frame is asked
 * instead, and the one with content answers.
 */
async function inBook<T>(
  page: Page,
  fn: () => T,
  fallback: T,
): Promise<T> {
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

async function bookText(page: Page) {
  return inBook(page, () => document.body?.innerText ?? "", "");
}

async function openReader(page: Page, at?: string) {
  await page.goto(at ? `${READER}?at=${encodeURIComponent(at)}` : READER);
  await page.waitForSelector("iframe", { timeout: 30_000 });
  // The book is on screen once something in it has been laid out, whether
  // that is a paragraph of text or the cover image.
  await expect
    .poll(
      () =>
        inBook(
          page,
          () => Math.round(document.body?.scrollWidth ?? 0),
          0,
        ),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
}

/** What the server currently thinks this member's position is. */
async function readingState(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch(
      "/api/study/books/alice-in-wonderland/reading",
      { credentials: "include" },
    );
    return response.ok
      ? ((await response.json()) as {
          progress: { locator?: string; percentage?: number } | null;
          notes: Array<{ locator?: string; chapterLabel?: string }>;
        })
      : null;
  });
}

/**
 * Open the reader at a known chapter.
 *
 * Rendering a section is asynchronous and its cost varies with the size of the
 * chunk, so this waits for the text to actually arrive rather than assuming a
 * fixed delay — the difference between a reliable suite and a flaky one.
 */
async function goToChapter(page: Page) {
  await openReader(page);
  await page.getByRole("button", { name: /contents/i }).click();
  await page.getByRole("button", { name: CHAPTER }).click();
  await expect
    .poll(() => bookText(page), {
      timeout: 30_000,
    })
    .toMatch(/Caucus-Race/i);
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

test.beforeEach(async ({ page }) => {
  const response = await page.goto(READER);
  test.skip(
    !response || response.status() >= 400 || page.url().includes("/books?"),
    "The pilot title is not in this database.",
  );
});

test("opens a real EPUB and renders its cover", async ({ page }) => {
  await openReader(page);

  // The cover is the first spine item, so this is a question about opening a
  // book for the first time. A member who is already part-way through it
  // correctly resumes where they were, and there is no cover to look at.
  const state = await readingState(page);
  test.skip(
    Boolean(state?.progress?.locator),
    "This member has already started the book, so it resumes past the cover.",
  );

  // That first item is a cover wrapper containing one SVG image and no text,
  // so asking whether words appeared would pass on a blank page.
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
  await openReader(page);

  // epub.js rewrites the book's linked CSS into blob: URLs. If the page's CSP
  // refuses them the book still renders, stripped of the typography it was
  // typeset with, and nothing anywhere reports a problem.
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

test("the reader's own controls are not buried under the hub's navigation", async ({
  page,
}) => {
  await openReader(page);

  // The hub's bottom bar and pet sit exactly where the reader's controls are.
  // A visible-but-unclickable control passes every assertion except this one.
  const blockedBy = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("button")).find((node) =>
      /contents/i.test(node.getAttribute("aria-label") ?? ""),
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
  await openReader(page);

  await page.getByRole("button", { name: /contents/i }).click();
  await page.getByRole("button", { name: CHAPTER }).click();

  await expect
    .poll(() => bookText(page), {
      timeout: 20_000,
    })
    .toMatch(/Caucus-Race/i);

  // The reader debounces its writes; wait for the position to actually land.
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const response = await fetch(
            "/api/study/books/alice-in-wonderland/reading",
            { credentials: "include" },
          );
          const body = await response.json();
          return body.progress?.locator ?? null;
        }),
      { timeout: 20_000 },
    )
    .toBeTruthy();

  await page.reload();
  await expect
    .poll(() => bookText(page), {
      timeout: 30_000,
    })
    .toMatch(/Caucus-Race/i);
});

test("reopening a book does not erase how far through it you are", async ({
  page,
}) => {
  await openReader(page);
  await page.getByRole("button", { name: /contents/i }).click();
  await page.getByRole("button", { name: CHAPTER }).click();

  const read = async () =>
    page.evaluate(async () => {
      const response = await fetch(
        "/api/study/books/alice-in-wonderland/reading",
        { credentials: "include" },
      );
      return (await response.json()).progress?.percentage ?? 0;
    });

  await expect.poll(read, { timeout: 20_000 }).toBeGreaterThan(0);
  const before = await read();

  // The percentage comes from an index epub.js builds after the book is on
  // screen. Reopening used to write the zero it answers in the meantime.
  await page.reload();
  await expect
    .poll(() => bookText(page), { timeout: 30_000 })
    .not.toBe("");
  await page.waitForTimeout(6000);
  expect(await read()).toBeGreaterThanOrEqual(before);
});

test("offers four actions on a selection, all of them on screen", async ({
  page,
}) => {
  await goToChapter(page);
  await selectAPassage(page);

  const toolbar = page.getByRole("toolbar", { name: /selection actions/i });
  for (const label of ["Highlight", "Note", "Task", "AI"]) {
    await expect(
      toolbar.getByRole("button", { name: new RegExp(`^${label}$`) }),
    ).toBeVisible();
  }

  // An action past the right-hand edge is an action nobody finds.
  const overflows = await page.evaluate(() => {
    const bar = document.querySelector('[aria-label="Selection actions"]');
    return bar ? bar.scrollWidth > bar.clientWidth + 1 : true;
  });
  expect(overflows, "the whole toolbar should fit across a phone").toBe(false);
});

test("a highlight records the chapter it came from", async ({ page }) => {
  await goToChapter(page);
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

  const notes = await page.evaluate(async () => {
    const response = await fetch(
      "/api/study/books/alice-in-wonderland/reading",
      { credentials: "include" },
    );
    return (await response.json()).notes ?? [];
  });
  // A CFI says where precisely; the chapter is what a student reads back.
  expect(notes[0]?.locator).toBeTruthy();
  expect(notes[0]?.chapterLabel).toContain("Caucus-Race");
});

test("a task raised from a passage lands in the planner", async ({ page }) => {
  await goToChapter(page);
  await selectAPassage(page);

  const title = `Revise the Caucus-Race ${Date.now()}`;
  const toolbar = page.getByRole("toolbar", { name: /selection actions/i });
  await toolbar.getByRole("button", { name: /^Task$/ }).click();

  const sheet = page.getByRole("dialog", { name: /add a task/i });
  await expect(sheet).toBeVisible();
  // Prefilled from the chapter, which only works if the chapter resolved.
  await expect(sheet.getByLabel("Task")).toHaveValue(/Caucus-Race/);
  await sheet.getByLabel("Task").fill(title);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/annotations") &&
        response.request().method() === "POST",
    ),
    sheet.getByRole("button", { name: /add to planner/i }).click(),
  ]);

  // The whole point of reusing AcademicTask: it shows up where coursework
  // does, with no separate list of "book tasks" anywhere.
  // The planner's tabs are links carrying a `view` parameter, so this is the
  // same place the Tasks tab goes.
  await page.goto("/student-hub/tools?view=tasks");
  await expect(page.getByText(title)).toBeVisible({ timeout: 20_000 });
});

test("a note links back into the book at its own passage", async ({ page }) => {
  await goToChapter(page);
  await selectAPassage(page);

  const toolbar = page.getByRole("toolbar", { name: /selection actions/i });
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/annotations")),
    toolbar.getByRole("button", { name: /^Highlight$/ }).click(),
  ]);

  await page.goto(`${READER}/notes`);
  await expect(page.getByText(CHAPTER).first()).toBeVisible();

  // `?at=` is how every surface links back into the book. It was generated in
  // three places and read in none, so all of them opened at the last saved
  // position instead of the passage that was tapped.
  await page.getByRole("link", { name: /open in the book/i }).first().click();
  await expect
    .poll(() => bookText(page), {
      timeout: 30_000,
    })
    .toMatch(/Caucus-Race/i);
});
