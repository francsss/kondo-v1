"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Highlighter,
  List,
  ListChecks,
  Loader2,
  Sparkles,
  StickyNote,
  Type,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { cn } from "@/lib/utils";
import type { ReaderTheme } from "@/lib/reader-theme";
import { READER_THEMES, readerThemeStyles } from "@/lib/reader-theme";
import { useImmersiveChrome } from "@/lib/use-focus-mode";
import type { TocEntry } from "@/lib/reader-chapters";
import { chapterIndex, documentPath } from "@/lib/reader-chapters";

/**
 * The EPUB reader.
 *
 * epub.js needs a DOM at import time, so it is imported inside an effect
 * rather than at module scope — this component is never rendered on the
 * server, and the library is not in any bundle a member downloads unless they
 * actually open a book.
 *
 * Reading is the page. Controls appear on a tap and go away again, because a
 * permanent toolbar over a book is a toolbar you read around. Everything
 * secondary — contents, bookmarks, type — opens from one row and closes when
 * it is done.
 *
 * Positions are CFIs throughout. A page number would be meaningless: EPUB text
 * reflows, so changing the type size renumbers every page, and a stored "page
 * 57" would land somewhere different every time the reader changed a setting.
 */

type Note = {
  id: string;
  locator: string | null;
  highlight: string | null;
  body: string | null;
  color: string | null;
  chapterLabel?: string | null;
  taskId?: string | null;
  task?: { title: string; status: string } | null;
};

type BookmarkRow = { id: string; locator: string; label: string | null };

type Selection = { cfi: string; text: string };

/**
 * The slice of epub.js this reader actually uses.
 *
 * The package ships types, but its rendition surface is loosely typed and the
 * rendered `currentLocation()` carries fields the published signature omits.
 * Declaring only what is called keeps `any` out of the component and makes the
 * dependency on the library explicit.
 */
type EpubLocation = { start?: { cfi?: string; href?: string } };

type EpubRendition = {
  themes: {
    fontSize: (value: string) => void;
    register: (name: string, styles: object) => void;
    select: (name: string) => void;
  };
  display: (target?: string) => Promise<void>;
  currentLocation: () => EpubLocation | undefined;
  annotations: {
    highlight: (
      cfiRange: string,
      data?: object,
      callback?: unknown,
      className?: string,
      styles?: Record<string, string>,
    ) => void;
  };
  on: (event: string, handler: (...args: never[]) => void) => void;
  destroy?: () => void;
};

type TocItem = TocEntry;

export function BookReader({
  slug,
  title,
  aiAllowed,
  initialLocator = null,
}: {
  slug: string;
  title: string;
  aiAllowed: boolean;
  /** Where to open, when something linked here at a particular passage. */
  initialLocator?: string | null;
}) {
  // The book owns the screen. Kondo's own navigation sits exactly where this
  // reader's controls are, so it steps aside for as long as a book is open.
  useImmersiveChrome();

  const viewerRef = useRef<HTMLDivElement>(null);
  // epub.js instances are not React state: they are imperative objects with
  // their own lifecycle, and putting them in state would re-render the reader
  // on every page turn.
  const bookRef = useRef<unknown>(null);
  const renditionRef = useRef<EpubRendition | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  // Built once from the table of contents and read on every page turn, so
  // naming the current chapter costs nothing per relocation.
  const chapterIndexRef = useRef<Map<string, string>>(new Map());
  /*
   * Whether the location index exists yet.
   *
   * This has to be tracked rather than inferred, because epub.js does not
   * fail when asked how far through a book a position is before it has
   * indexed one — `percentageFromCfi` returns 0. Zero and "not known yet"
   * are indistinguishable from the outside, and the first relocation after
   * opening a book always arrives during that window, so every reopen was
   * writing 0 over whatever progress had been made. My Books then reported a
   * half-read book as "Not started".
   */
  const locationsReadyRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chrome, setChrome] = useState(true);
  const [percentage, setPercentage] = useState(0);
  const [chapter, setChapter] = useState<string | null>(null);
  const [currentCfi, setCurrentCfi] = useState<string | null>(null);
  const [panel, setPanel] = useState<"none" | "toc" | "marks" | "type">("none");
  const [toc, setToc] = useState<Array<{ label: string; href: string }>>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  // A bottom sheet rather than window.prompt: a native prompt cannot be styled,
  // cannot show the passage being annotated, and on iOS steals the page.
  const [noteDraft, setNoteDraft] = useState<Selection | null>(null);
  const [taskDraft, setTaskDraft] = useState<Selection | null>(null);
  const [theme, setTheme] = useState<ReaderTheme>("light");
  const [fontSize, setFontSize] = useState(100);

  /**
   * Persist the position, but not on every page turn.
   *
   * Turning a page fires immediately and often; writing each one would be a
   * request per tap for a value only the next open reads. Two seconds of quiet
   * is enough, and the same timer is flushed on unmount so closing the book
   * mid-chapter does not lose the last page.
   */
  const scheduleSave = useCallback(
    (cfi: string, percent: number | null) => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        void fetch(`/api/study/books/${slug}/reading`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          // `percentage` is omitted, not zeroed, when the location index is
          // still building. Sending a zero here would tell the server someone
          // who is halfway through a book has not started it.
          body: JSON.stringify({
            locator: cfi,
            ...(percent === null ? {} : { percentage: percent }),
          }),
          keepalive: true,
        }).catch(() => null);
        // The slug and the percentage only — never the locator, which is a
        // precise position inside a book someone is reading.
        captureProductEvent(PRODUCT_EVENTS.BOOK_PROGRESS_SAVED, {
          slug,
          percentage: percent,
        });
      }, 2000);
    },
    [slug],
  );

  useEffect(() => {
    let cancelled = false;

    async function open() {
      try {
        // Both the file URL and the saved position come from the server, and
        // both are entitlement-checked there.
        const [accessResponse, stateResponse] = await Promise.all([
          fetch(`/api/study/books/${slug}/access`, { credentials: "include" }),
          fetch(`/api/study/books/${slug}/reading`, { credentials: "include" }),
        ]);
        if (!accessResponse.ok) {
          const body = await accessResponse.json().catch(() => null);
          throw new Error(body?.error ?? "This book could not be opened.");
        }
        const access = await accessResponse.json();
        const state = stateResponse.ok ? await stateResponse.json() : null;
        if (cancelled) return;

        setNotes(state?.notes ?? []);
        setBookmarks(state?.bookmarks ?? []);

        /*
         * The bytes are fetched here and handed to epub.js as a buffer rather
         * than as a URL. Given a URL, epub.js guesses whether it points at a
         * zipped book or an unpacked directory by looking for a `.epub`
         * extension — and neither of Kondo's URLs has one. The streaming route
         * ends in a path segment, and an S3 signed URL ends in its query
         * string, so both were being read as directories and the reader
         * requested `META-INF/container.xml` from the API.
         */
        const fileResponse = await fetch(access.url, {
          credentials: "include",
        });
        if (!fileResponse.ok) {
          throw new Error("This book could not be downloaded.");
        }
        const archive = await fileResponse.arrayBuffer();

        const ePub = (await import("epubjs")).default;
        if (cancelled || !viewerRef.current) return;

        const book = ePub(archive);
        bookRef.current = book;
        const rendition = book.renderTo(viewerRef.current, {
          width: "100%",
          height: "100%",
          spread: "none",
        } as never);
        // The published `Rendition` type describes `currentLocation()` as the
        // pre-render variant, which has no `start`. Narrowing through unknown
        // keeps the rest of the component honestly typed.
        renditionRef.current = rendition as unknown as EpubRendition;

        rendition.themes.fontSize(`${fontSize}%`);
        rendition.themes.register("kondo", readerThemeStyles(theme));
        rendition.themes.select("kondo");

        /*
         * Resume from the stored CFI, which survives a font-size change in a
         * way a page number could not — but never at the cost of opening the
         * book at all. A locator can stop resolving for reasons that are
         * nobody's fault: the file is replaced with a different edition, or an
         * older client wrote a locator this one cannot parse. epub.js throws
         * "No Section Found" for those, and a reader that refuses to open a
         * book someone owns is a far worse outcome than one that opens it at
         * the beginning.
         */
        const saved =
          initialLocator ?? state?.progress?.locator ?? undefined;
        try {
          await rendition.display(saved);
        } catch {
          // A requested locator that will not resolve falls back to the saved
          // position before it falls back to the beginning, so a stale link
          // still lands somewhere the member recognises.
          try {
            const fallback = state?.progress?.locator ?? undefined;
            await rendition.display(
              fallback && fallback !== saved ? fallback : undefined,
            );
          } catch {
            await rendition.display();
          }
        }

        const navigation = await book.loaded.navigation;
        if (!cancelled) {
          const items = (navigation.toc ?? []) as TocItem[];
          setToc(
            items.map((item) => ({
              label: String(item.label ?? "").trim(),
              href: String(item.href ?? ""),
            })),
          );
          chapterIndexRef.current = chapterIndex(items);
          // The first relocation usually fires before the navigation resolves,
          // so the opening chapter would otherwise stay unnamed until the
          // reader turned a page.
          // Same narrowing as elsewhere: the published type describes the
          // pre-render location, which has no `start`.
          const openedAt = (
            rendition.currentLocation() as EpubLocation | undefined
          )?.start?.href;
          if (openedAt) {
            setChapter(
              chapterIndexRef.current.get(documentPath(openedAt)) ?? null,
            );
          }
        }

        // Locations make a percentage meaningful. Generated after first paint
        // so opening the book is not blocked on indexing it.
        void book.locations.generate(1600).then(() => {
          if (cancelled) return;
          locationsReadyRef.current = true;
          // epub.js types `currentLocation()` as the promise-free variant even
          // though the rendered one carries `start`; narrowed here rather than
          // trusted so a missing shape cannot throw during indexing.
          const current = rendition.currentLocation() as
            | { start?: { cfi?: string } }
            | undefined;
          const cfi = current?.start?.cfi;
          if (cfi) {
            const percent = Math.round(
              book.locations.percentageFromCfi(cfi) * 100,
            );
            setPercentage(percent);
            // Now that the answer is known, write it: the relocations that
            // happened while indexing deliberately left the stored percentage
            // untouched, so without this a reader who opens a book and does
            // not turn a page keeps yesterday's figure.
            scheduleSave(cfi, percent);
          }
        });

        rendition.on("relocated", ((location: EpubLocation) => {
          if (cancelled) return;
          const cfi = location?.start?.cfi;
          if (!cfi) return;
          // Null, not zero, while the index is still being built: "unknown"
          // and "at the very beginning" are different answers, and only one of
          // them should be written down.
          let percent: number | null = null;
          if (locationsReadyRef.current) {
            try {
              const value = Math.round(
                book.locations.percentageFromCfi(cfi) * 100,
              );
              if (Number.isFinite(value)) percent = value;
            } catch {
              // An unindexable locator still deserves to have its position
              // saved; only the percentage is unknown.
            }
          }
          setCurrentCfi(cfi);
          if (percent !== null) setPercentage(percent);
          const href = location?.start?.href;
          setChapter(
            (href ? chapterIndexRef.current.get(documentPath(href)) : null) ??
              null,
          );
          scheduleSave(cfi, percent);
        }) as (...args: never[]) => void);

        // Selection inside the rendered iframe. The CFI range is what gets
        // stored — DOM coordinates would not survive a re-render.
        rendition.on("selected", ((
          cfiRange: string,
          contents: { window: Window },
        ) => {
          const text = contents.window.getSelection()?.toString()?.trim() ?? "";
          if (text.length < 2) return;
          setSelection({ cfi: cfiRange, text });
          setChrome(true);
        }) as (...args: never[]) => void);

        // Re-apply saved highlights so they survive a reload and a new session.
        for (const note of state?.notes ?? []) {
          if (!note.locator) continue;
          try {
            rendition.annotations.highlight(
              note.locator,
              {},
              undefined,
              undefined,
              { fill: note.color ?? "#cfef5d" },
            );
          } catch {
            // A CFI from a different edition of the file will not resolve.
            // Losing one highlight is better than failing to open the book.
          }
        }

        if (!cancelled) {
          setLoading(false);
          // Emitted after the book renders, not when the page mounts, so the
          // count means "a book was read" rather than "a route was hit".
          captureProductEvent(PRODUCT_EVENTS.BOOK_OPENED, { slug });
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "This book could not be opened.",
          );
          setLoading(false);
        }
      }
    }

    void open();
    return () => {
      cancelled = true;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      try {
        renditionRef.current?.destroy?.();
      } catch {
        // Destroying an unopened rendition is not an error worth surfacing.
      }
    };
    // Deliberately opens once. Theme and font size are applied through the
    // rendition imperatively below rather than by re-opening the book.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    renditionRef.current?.themes?.fontSize?.(`${fontSize}%`);
  }, [fontSize]);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition?.themes) return;
    rendition.themes.register("kondo", readerThemeStyles(theme));
    rendition.themes.select("kondo");
  }, [theme]);

  async function saveAnnotation(
    body: string | null,
    target: Selection | null = selection,
    task: { title: string; dueAt?: string | null } | null = null,
  ) {
    if (!target) return;
    const response = await fetch(`/api/study/books/${slug}/annotations`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "annotation",
        locator: target.cfi,
        selectedText: target.text,
        body,
        color: "#cfef5d",
        // Where in the book this was, in words. The CFI says where precisely;
        // this is what the member reads back on the notes page.
        chapterLabel: chapter,
        task,
      }),
    });
    if (!response.ok) return;
    const { note } = await response.json();
    setNotes((current) => [note, ...current]);
    captureProductEvent(
      task
        ? PRODUCT_EVENTS.BOOK_TASK_CREATED
        : body
          ? PRODUCT_EVENTS.BOOK_NOTE_CREATED
          : PRODUCT_EVENTS.BOOK_HIGHLIGHT_CREATED,
      { slug },
    );
    try {
      renditionRef.current?.annotations?.highlight(
        target.cfi,
        {},
        undefined,
        undefined,
        { fill: "#cfef5d" },
      );
    } catch {
      // The highlight is saved either way; only the visual overlay failed.
    }
    setSelection(null);
  }

  async function toggleBookmark() {
    // An event handler may read the ref; this is the freshest position even if
    // `relocated` has not fired yet for the very first page.
    const cfi =
      currentCfi ?? renditionRef.current?.currentLocation()?.start?.cfi;
    if (!cfi) return;
    const existing = bookmarks.find((mark) => mark.locator === cfi);
    if (existing) {
      await fetch(`/api/study/annotations/${existing.id}?kind=bookmark`, {
        method: "DELETE",
        credentials: "include",
      });
      setBookmarks((current) =>
        current.filter((mark) => mark.id !== existing.id),
      );
      return;
    }
    const response = await fetch(`/api/study/books/${slug}/annotations`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "bookmark",
        locator: cfi,
        label: chapter,
      }),
    });
    if (!response.ok) return;
    const { bookmark } = await response.json();
    setBookmarks((current) => [bookmark, ...current]);
  }

  // Kept in state rather than read from the rendition during render: a ref
  // read at render time would not re-run when the page turned, so the bookmark
  // icon would show the state of whichever page happened to render last.
  const bookmarked = bookmarks.some((mark) => mark.locator === currentCfi);

  if (error) {
    return (
      <div className="grid min-h-[70vh] place-items-center px-6 text-center">
        <div>
          <p className="text-3xl">📕</p>
          <h1 className="mt-3 text-lg font-black">{title}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {error}
          </p>
          <Button asChild className="mt-5" variant="secondary">
            <Link href="/student-hub/books">Back to Books</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-40 flex flex-col",
        READER_THEMES[theme].shell,
      )}
    >
      {/* Safe areas: the top bar clears a notch and the controls clear a home
          indicator, so neither sits under system furniture on a phone. */}
      <header
        className={cn(
          "flex shrink-0 items-center gap-2 px-3 pb-2 transition-opacity duration-200 motion-reduce:transition-none",
          chrome ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <Button aria-label="Back to Books" asChild size="icon" variant="ghost">
          <Link href="/student-hub/books">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-black">
          {title}
        </p>
        <Button
          aria-label={bookmarked ? "Remove bookmark" : "Bookmark this page"}
          aria-pressed={bookmarked}
          onClick={() => void toggleBookmark()}
          size="icon"
          variant="ghost"
        >
          {bookmarked ? (
            <BookmarkCheck className="h-5 w-5" />
          ) : (
            <Bookmark className="h-5 w-5" />
          )}
        </Button>
      </header>

      <div className="relative min-h-0 flex-1">
        {loading ? (
          <div className="absolute inset-0 grid place-items-center">
            <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" />
          </div>
        ) : null}
        {/* One tap toggles the chrome. The reader itself owns the gestures for
            page turns, so this only listens where epub.js does not. */}
        <div
          className="h-full w-full"
          onClick={() => setChrome((value) => !value)}
          ref={viewerRef}
        />
      </div>

      {selection ? (
        <SelectionBar
          aiAllowed={aiAllowed}
          onAsk={() => {
            const params = new URLSearchParams({
              text: selection.text.slice(0, 1200),
              cfi: selection.cfi,
              ...(chapter ? { chapter } : {}),
            });
            captureProductEvent(PRODUCT_EVENTS.BOOK_AI_OPENED, { slug });
            window.location.href = `/student-hub/books/${slug}/ask?${params}`;
          }}
          onDismiss={() => setSelection(null)}
          onHighlight={() => void saveAnnotation(null)}
          onNote={() => {
            setNoteDraft(selection);
            setSelection(null);
          }}
          onTask={() => {
            setTaskDraft(selection);
            setSelection(null);
          }}
        />
      ) : null}

      {noteDraft ? (
        <NoteSheet
          chapter={chapter}
          onCancel={() => setNoteDraft(null)}
          onSave={(body) => {
            void saveAnnotation(body, noteDraft);
            setNoteDraft(null);
          }}
          passage={noteDraft.text}
        />
      ) : null}

      {taskDraft ? (
        <TaskSheet
          bookTitle={title}
          chapter={chapter}
          onCancel={() => setTaskDraft(null)}
          onSave={(task) => {
            void saveAnnotation(null, taskDraft, task);
            setTaskDraft(null);
          }}
          passage={taskDraft.text}
        />
      ) : null}

      <footer
        className={cn(
          "shrink-0 transition-opacity duration-200 motion-reduce:transition-none",
          chrome ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        {panel !== "none" ? (
          <ReaderPanel
            bookmarks={bookmarks}
            fontSize={fontSize}
            notes={notes}
            onClose={() => setPanel("none")}
            onFontSize={setFontSize}
            onGo={(locator) => {
              void renditionRef.current?.display(locator);
              setPanel("none");
            }}
            notesHref={`/student-hub/books/${slug}/notes`}
            onTheme={setTheme}
            panel={panel}
            theme={theme}
            toc={toc}
          />
        ) : null}

        <div className="flex items-center gap-1 px-3 pt-2">
          <Button
            aria-label="Contents"
            onClick={() => setPanel(panel === "toc" ? "none" : "toc")}
            size="sm"
            variant="ghost"
          >
            <List className="h-4 w-4" /> Contents
          </Button>
          <Button
            aria-label="Bookmarks and notes"
            onClick={() => setPanel(panel === "marks" ? "none" : "marks")}
            size="sm"
            variant="ghost"
          >
            <Bookmark className="h-4 w-4" /> Marks
          </Button>
          <Button
            aria-label="Text settings"
            onClick={() => setPanel(panel === "type" ? "none" : "type")}
            size="sm"
            variant="ghost"
          >
            <Type className="h-4 w-4" /> Aa
          </Button>
          <span className="ml-auto text-xs font-black tabular-nums opacity-70">
            {percentage}%
          </span>
        </div>
      </footer>
    </div>
  );
}

/**
 * Writing a note about the passage you just selected.
 *
 * The passage stays visible above the field, because a note written without
 * the sentence in front of you is a note about something half-remembered. It
 * opens focused and closes on Escape, and it clears the bottom safe area so
 * the save control is not under a home indicator.
 */
function NoteSheet({
  passage,
  chapter,
  onSave,
  onCancel,
}: {
  passage: string;
  chapter: string | null;
  onSave: (body: string) => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState("");

  return (
    <Sheet label="Add a note" onCancel={onCancel} title="Add a note">
      {chapter ? (
        <p className="mt-1 text-xs font-bold text-muted-foreground">
          {chapter}
        </p>
      ) : null}
      <blockquote className="mt-2 max-h-24 overflow-y-auto border-l-2 border-kondo-green pl-3 text-sm leading-6 text-muted-foreground">
        {passage}
      </blockquote>
      <textarea
        aria-label="Your note"
        autoFocus
        className="mt-3 h-28 w-full resize-none rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:border-kondo-green"
        maxLength={4000}
        onChange={(event) => setBody(event.target.value)}
        placeholder="What do you want to remember about this?"
        value={body}
      />
      <div className="mt-3 flex gap-2">
        <Button fullWidth onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button
          disabled={!body.trim()}
          fullWidth
          onClick={() => onSave(body.trim())}
        >
          Save note
        </Button>
      </div>
    </Sheet>
  );
}

/**
 * Raising a task from a passage.
 *
 * What this produces is an ordinary planner task — the same kind the planner's
 * own form makes, appearing in Tasks alongside coursework, with no separate
 * "book tasks" list anywhere. The passage and the chapter travel into its
 * description, so the task still means something when it is read a week later
 * in the planner with the book closed.
 *
 * The title is prefilled from the chapter rather than left blank: a member
 * marking a paragraph to come back to should be one tap from a usable task.
 */
function TaskSheet({
  passage,
  chapter,
  bookTitle,
  onSave,
  onCancel,
}: {
  passage: string;
  chapter: string | null;
  bookTitle: string;
  onSave: (task: { title: string; dueAt: string | null }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(
    `Re-read ${chapter?.trim() || bookTitle}`.slice(0, 200),
  );
  const [dueAt, setDueAt] = useState("");

  return (
    <Sheet label="Add a task" onCancel={onCancel} title="Add a task">
      <p className="mt-1 text-xs font-bold text-muted-foreground">
        Goes to your planner{chapter ? ` · ${chapter}` : ""}
      </p>
      <blockquote className="mt-2 max-h-20 overflow-y-auto border-l-2 border-kondo-green pl-3 text-sm leading-6 text-muted-foreground">
        {passage}
      </blockquote>
      <input
        aria-label="Task"
        autoFocus
        className="mt-3 w-full rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:border-kondo-green"
        maxLength={200}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="What do you need to do?"
        value={title}
      />
      <label className="mt-3 block">
        <span className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
          Due (optional)
        </span>
        <input
          aria-label="Due date"
          className="mt-1 w-full rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:border-kondo-green"
          onChange={(event) => setDueAt(event.target.value)}
          type="date"
          value={dueAt}
        />
      </label>
      <div className="mt-3 flex gap-2">
        <Button fullWidth onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button
          disabled={!title.trim()}
          fullWidth
          onClick={() =>
            onSave({ title: title.trim(), dueAt: dueAt || null })
          }
        >
          Add to planner
        </Button>
      </div>
    </Sheet>
  );
}

/**
 * The bottom sheet both drafts share.
 *
 * A native `prompt()` cannot show the passage being annotated, cannot be
 * styled, and on iOS takes over the page — so this is a real sheet, with the
 * bottom safe area cleared so its buttons are not under a home indicator.
 */
function Sheet({
  label,
  title,
  children,
  onCancel,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
}) {
  return (
    <div
      aria-label={label}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end bg-black/40"
      onClick={onCancel}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
      role="dialog"
    >
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border-t border-border bg-card p-4"
        onClick={(event) => event.stopPropagation()}
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </p>
        {children}
      </div>
    </div>
  );
}

/**
 * The four things you can do with a selection, and nothing else.
 *
 * Highlight, Note, Task, AI — one row, no submenus. What AI can be asked is
 * deliberately not here: the four question types live on the Ask surface,
 * behind the AI action, so selecting a sentence does not present eight choices
 * at once on a phone.
 *
 * The whole row has to fit across a phone, and "fit" cannot depend on how wide
 * a particular font renders four words. The actions share the width equally
 * and their labels truncate, so the row is exactly as wide as the toolbar at
 * any font, any text size and in any language — the icons stay legible even
 * where a label cannot. Sizing to the content instead put "AI" and the
 * dismiss off the right-hand edge under the production font, where nobody
 * would have found them.
 */
function SelectionBar({
  aiAllowed,
  onHighlight,
  onNote,
  onTask,
  onAsk,
  onDismiss,
}: {
  aiAllowed: boolean;
  onHighlight: () => void;
  onNote: () => void;
  onTask: () => void;
  onAsk: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="pointer-events-auto absolute inset-x-3 bottom-24 z-50 flex items-center gap-0.5 rounded-2xl border border-border bg-card p-1.5 shadow-lift"
      role="toolbar"
      aria-label="Selection actions"
    >
      <SelectionAction icon={Highlighter} label="Highlight" onClick={onHighlight} />
      <SelectionAction icon={StickyNote} label="Note" onClick={onNote} />
      <SelectionAction icon={ListChecks} label="Task" onClick={onTask} />
      {/* Absent, not disabled, when the licence forbids it — a greyed button
          invites a question the reader cannot resolve. */}
      {aiAllowed ? (
        <SelectionAction icon={Sparkles} label="AI" onClick={onAsk} />
      ) : null}
      <button
        aria-label="Dismiss"
        className="grid h-9 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
        onClick={onDismiss}
        type="button"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

function SelectionAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Highlighter;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      // `min-w-0` is what actually lets this shrink: a flex item defaults to
      // its content's minimum width, which is how a row of four labelled
      // actions ends up wider than the phone it is on.
      className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-1.5 text-xs font-bold transition hover:bg-muted active:scale-[0.98] motion-reduce:transform-none"
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function ReaderPanel({
  panel,
  toc,
  notes,
  bookmarks,
  theme,
  fontSize,
  onGo,
  onTheme,
  onFontSize,
  onClose,
}: {
  panel: "toc" | "marks" | "type";
  toc: Array<{ label: string; href: string }>;
  notes: Note[];
  bookmarks: BookmarkRow[];
  theme: ReaderTheme;
  fontSize: number;
  onGo: (locator: string) => void;
  onTheme: (theme: ReaderTheme) => void;
  onFontSize: (size: number) => void;
  onClose: () => void;
  notesHref: string;
}) {
  return (
    <div className="mx-3 max-h-[46vh] overflow-y-auto rounded-2xl border border-border bg-card p-3 shadow-lift">
      {panel === "toc" ? (
        <ul className="space-y-1">
          {toc.length ? (
            toc.map((item) => (
              <li key={item.href}>
                <button
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-muted"
                  onClick={() => onGo(item.href)}
                  type="button"
                >
                  {item.label || "Untitled section"}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              This book has no table of contents.
            </li>
          )}
        </ul>
      ) : null}

      {panel === "marks" ? (
        <div className="space-y-3">
          <Section title="Bookmarks">
            {bookmarks.length ? (
              bookmarks.map((mark) => (
                <button
                  className="block w-full truncate rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
                  key={mark.id}
                  onClick={() => onGo(mark.locator)}
                  type="button"
                >
                  {mark.label ?? "Bookmark"}
                </button>
              ))
            ) : (
              <Empty>No bookmarks yet.</Empty>
            )}
          </Section>
          <Section title="Highlights and notes">
            {notes.length ? (
              notes.map((note) => (
                <button
                  className="block w-full rounded-xl px-3 py-2 text-left hover:bg-muted"
                  key={note.id}
                  onClick={() => note.locator && onGo(note.locator)}
                  type="button"
                >
                  <span className="block truncate text-sm">
                    {note.highlight ?? note.body}
                  </span>
                  {note.highlight && note.body ? (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {note.body}
                    </span>
                  ) : null}
                  {note.task ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-kondo-green">
                      <ListChecks className="h-3 w-3" />
                      {note.task.title}
                    </span>
                  ) : null}
                </button>
              ))
            ) : (
              <Empty>Select text in the book to highlight it.</Empty>
            )}
          </Section>
        </div>
      ) : null}

      {panel === "type" ? (
        <div className="space-y-4 p-1">
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
              Text size
            </p>
            <div className="flex items-center gap-2">
              <Button
                aria-label="Smaller text"
                onClick={() => onFontSize(Math.max(70, fontSize - 10))}
                size="sm"
                variant="secondary"
              >
                A−
              </Button>
              <span className="text-sm font-black tabular-nums">
                {fontSize}%
              </span>
              <Button
                aria-label="Larger text"
                onClick={() => onFontSize(Math.min(180, fontSize + 10))}
                size="sm"
                variant="secondary"
              >
                A+
              </Button>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
              Theme
            </p>
            <div className="flex gap-2">
              {(Object.keys(READER_THEMES) as ReaderTheme[]).map((key) => (
                <button
                  aria-pressed={theme === key}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-xs font-bold capitalize",
                    theme === key ? "border-kondo-green" : "border-border",
                  )}
                  key={key}
                  onClick={() => onTheme(key)}
                  type="button"
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <Button
        className="mt-3"
        fullWidth
        onClick={onClose}
        size="sm"
        variant="ghost"
      >
        Close
      </Button>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 px-3 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-4 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
