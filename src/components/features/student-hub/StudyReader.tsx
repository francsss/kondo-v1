"use client";

import { useRouter } from "next/navigation";
import {
  BookOpen,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  NotebookPen,
  Sparkles,
  SquareCheckBig,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { STUDY_ASSISTANT_ACTIONS } from "@/lib/study-assistant-actions";
import { useFocusMode } from "@/lib/use-focus-mode";
import { useScrollRetreat } from "@/lib/use-scroll-retreat";
import { cn } from "@/lib/utils";

type Chapter = { id: string; position: number; title: string; body: string };
type Note = {
  id: string;
  chapterId: string | null;
  highlight: string | null;
  body: string | null;
  taskId: string | null;
};

/**
 * The reading surface of Study Essentials.
 *
 * Selecting a passage opens the actions the brief describes: keep it as a
 * highlight, write a note about it, or raise a task. The task is created in
 * the existing planner — this screen never stores a task of its own.
 * "Ask Kondo AI" runs server-side: the client sends the slug, chapter and the
 * selected passage, and the key never leaves the server. When no key is
 * configured the action is offered as unavailable rather than hidden, so the
 * rest of the reader still works exactly as before.
 */
export function StudyReader({
  slug,
  title,
  chapters,
  initialChapterId,
  initialNotes,
}: {
  slug: string;
  title: string;
  chapters: Chapter[];
  initialChapterId: string | null;
  initialNotes: Note[];
}) {
  const router = useRouter();
  const [chapterId, setChapterId] = useState(
    initialChapterId ?? chapters[0]?.id ?? "",
  );
  const [notes, setNotes] = useState(initialNotes);
  const { focused, toggle: toggleFocus } = useFocusMode();
  const retreated = useScrollRetreat();
  const [selection, setSelection] = useState("");
  const [draft, setDraft] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [mode, setMode] = useState<"note" | "task" | "ai" | null>(null);
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiAction, setAiAction] = useState<string | null>(null);
  const [assistantReady, setAssistantReady] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  const index = Math.max(
    0,
    chapters.findIndex((chapter) => chapter.id === chapterId),
  );
  const chapter = chapters[index];
  const chapterNotes = notes.filter((note) => note.chapterId === chapterId);

  // Reading position is remembered per resource, so the library can reopen
  // where the student stopped.
  useEffect(() => {
    if (!chapterId) return;
    const timer = window.setTimeout(() => {
      void fetch("/api/student-hub/essentials/progress", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, chapterId }),
      }).catch(() => undefined);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [chapterId, slug]);

  const readSelection = useCallback(() => {
    const text = window.getSelection()?.toString().trim() ?? "";
    if (!text || text.length < 3) return;
    if (!bodyRef.current) return;
    const anchor = window.getSelection()?.anchorNode;
    if (anchor && !bodyRef.current.contains(anchor)) return;
    setSelection(text.slice(0, 2000));
    setMode(null);
    setError("");
    setSaved("");
  }, []);

  // Whether the assistant is available is a server fact; ask once.
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/student-hub/essentials/assistant", {
      credentials: "include",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setAssistantReady(Boolean(data?.configured));
      })
      .catch(() => {
        if (!cancelled) setAssistantReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function closePanel() {
    setSelection("");
    setDraft("");
    setTaskTitle("");
    setMode(null);
    setError("");
    setAiAnswer("");
    setAiAction(null);
  }

  async function ask(action: string) {
    setSaving(true);
    setError("");
    setAiAnswer("");
    setAiAction(action);
    try {
      const response = await fetch("/api/student-hub/essentials/assistant", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, chapterId, passage: selection, action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "The assistant could not answer.");
        return;
      }
      setAiAnswer(data.answer);
    } catch {
      setError("Kondo could not reach the assistant. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  /** Keeps an assistant answer as a note, so it lands in Notes like any other. */
  async function keepAnswer() {
    setDraft(aiAnswer);
    setMode("note");
    setAiAnswer("");
  }

  async function save(withTask: boolean) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/student-hub/essentials/notes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          chapterId,
          highlight: selection,
          body: draft || null,
          task: withTask
            ? { title: taskTitle || selection.slice(0, 200) }
            : null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "The note could not be saved.");
        return;
      }
      setNotes((current) => [
        {
          id: data.note.id,
          chapterId,
          highlight: selection,
          body: draft || null,
          taskId: data.note.taskId ?? null,
        },
        ...current,
      ]);
      setSaved(withTask ? "Note and task created." : "Highlight saved.");
      closePanel();
      if (withTask) router.refresh();
    } catch {
      setError("Kondo could not save this. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!chapter) {
    return (
      <p className="rounded-[1.5rem] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        This resource has no readable chapters yet.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-6 lg:items-start",
        // Focus Mode drops the chapter rail and lets the text run wide. Same
        // component, same state — only the layout changes.
        focused ? "grid-cols-1" : "lg:grid-cols-[260px_minmax(0,1fr)]",
      )}
    >
      <nav
        aria-label="Chapters"
        className={cn(
          "rounded-[1.5rem] border border-border bg-card p-3 lg:sticky lg:top-20",
          focused && "hidden",
        )}
      >
        <p className="px-2 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          Chapters
        </p>
        <ol className="mt-1 grid gap-0.5">
          {chapters.map((item) => {
            const active = item.id === chapterId;
            return (
              <li key={item.id}>
                <button
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-sm transition",
                    active
                      ? "bg-kondo-mint font-black text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  onClick={() => setChapterId(item.id)}
                  type="button"
                >
                  <span className="mt-0.5 shrink-0 tabular-nums opacity-60">
                    {item.position}
                  </span>
                  <span className="min-w-0 leading-5">{item.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="min-w-0">
        <article
          className={cn(
            "border border-border bg-card",
            focused
              ? "mx-auto max-w-[68ch] rounded-none border-x-0 px-5 py-8 sm:px-8"
              : "rounded-[1.75rem] p-5 sm:p-8",
          )}
        >
          {/*
           * The reader's controls retreat while the student is scrolling
           * forward and come back the moment they scroll up. Visibility only —
           * the row keeps its space, so the chapter text never jumps under the
           * line being read.
           */}
          <div
            aria-hidden={retreated}
            className={cn(
              "flex items-start justify-between gap-3 transition-opacity duration-200",
              retreated && "pointer-events-none opacity-0",
            )}
          >
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-kondo-green">
              <BookOpen
                aria-hidden="true"
                className="mr-1.5 inline h-3.5 w-3.5"
              />
              {title} · Chapter {chapter.position}
            </p>
            {/* Discreet, and the only chrome Focus Mode leaves behind. */}
            <button
              aria-label={focused ? "Leave Focus Mode" : "Enter Focus Mode"}
              aria-pressed={focused}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
              onClick={toggleFocus}
              title={focused ? "Leave Focus Mode (Esc)" : "Focus Mode"}
              type="button"
            >
              {focused ? (
                <Minimize2 aria-hidden="true" className="h-4 w-4" />
              ) : (
                <Maximize2 aria-hidden="true" className="h-4 w-4" />
              )}
            </button>
          </div>
          <h2 className="mt-3 text-balance font-display text-2xl font-black leading-tight tracking-[-0.03em] sm:text-3xl">
            {chapter.title}
          </h2>
          <p
            aria-hidden={retreated}
            className={cn(
              "mt-4 text-xs text-muted-foreground transition-opacity duration-200",
              retreated && "opacity-0",
            )}
          >
            Select any passage to highlight it, write a note, or raise a task.
          </p>
          <div
            className="mt-5 select-text whitespace-pre-wrap text-base leading-8 text-foreground/90 selection:bg-kondo-lime/50"
            onMouseUp={readSelection}
            onTouchEnd={readSelection}
            ref={bodyRef}
          >
            {chapter.body}
          </div>
          {/* The reader's only persistent status: where you are in the book. */}
          <p className="mt-6 text-center text-[11px] font-bold tabular-nums text-muted-foreground">
            {chapter.position} / {chapters.length}
          </p>

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
            <Button
              disabled={index === 0}
              onClick={() => setChapterId(chapters[index - 1]!.id)}
              variant="ghost"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <span className="text-xs font-bold tabular-nums text-muted-foreground">
              {index + 1} / {chapters.length}
            </span>
            <Button
              disabled={index === chapters.length - 1}
              onClick={() => setChapterId(chapters[index + 1]!.id)}
              variant="secondary"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </article>

        {saved ? (
          <p
            aria-live="polite"
            className="mt-4 rounded-2xl bg-kondo-mint px-4 py-3 text-sm font-bold text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
          >
            <Check aria-hidden="true" className="mr-1.5 inline h-4 w-4" />
            {saved}
          </p>
        ) : null}

        {chapterNotes.length ? (
          <section className="mt-5">
            <h3 className="text-sm font-black tracking-tight">
              Your notes on this chapter
            </h3>
            <ul className="mt-3 grid gap-2.5">
              {chapterNotes.map((note) => (
                <li
                  className="rounded-2xl border border-border bg-card p-4"
                  key={note.id}
                >
                  {note.highlight ? (
                    <blockquote className="border-l-2 border-kondo-green pl-3 text-sm italic leading-6 text-muted-foreground">
                      {note.highlight}
                    </blockquote>
                  ) : null}
                  {note.body ? (
                    <p className="mt-2.5 text-sm leading-6">{note.body}</p>
                  ) : null}
                  {note.taskId ? (
                    <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-black text-muted-foreground">
                      <SquareCheckBig aria-hidden="true" className="h-3 w-3" />
                      Task created in your planner
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {selection ? (
        <div
          aria-label="Selection actions"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl"
          role="dialog"
        >
          <div className="mx-auto max-w-[720px]">
            <div className="flex items-start gap-3">
              <blockquote className="min-w-0 flex-1 border-l-2 border-kondo-green pl-3 text-sm italic leading-6 text-muted-foreground">
                <span className="line-clamp-3">{selection}</span>
              </blockquote>
              <button
                aria-label="Dismiss selection"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition hover:text-foreground"
                onClick={closePanel}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {mode === "note" ? (
              <textarea
                autoFocus
                className="kondo-field mt-3 min-h-24 w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-base outline-none sm:text-sm"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="What do you want to remember about this?"
                value={draft}
              />
            ) : null}
            {mode === "task" ? (
              <input
                autoFocus
                className="kondo-field mt-3 h-12 w-full rounded-2xl border border-border bg-background px-4 text-base outline-none sm:text-sm"
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder="Task title, e.g. Review neural networks"
                value={taskTitle}
              />
            ) : null}

            {mode === "ai" && aiAnswer ? (
              <div
                aria-live="polite"
                className="mt-3 max-h-56 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-4"
              >
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-kondo-green">
                  <Bot
                    aria-hidden="true"
                    className="mr-1.5 inline h-3.5 w-3.5"
                  />
                  Kondo AI
                </p>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6">
                  {aiAnswer}
                </div>
                <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
                  Generated from the passage you selected. Check anything you
                  rely on for an exam.
                </p>
              </div>
            ) : null}

            {error ? (
              <p
                className="mt-3 rounded-2xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {mode === null ? (
                <>
                  <Button
                    disabled={saving}
                    onClick={() => save(false)}
                    size="sm"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Highlight
                  </Button>
                  <Button
                    onClick={() => setMode("note")}
                    size="sm"
                    variant="secondary"
                  >
                    <NotebookPen className="h-4 w-4" /> Note
                  </Button>
                  <Button
                    onClick={() => setMode("task")}
                    size="sm"
                    variant="secondary"
                  >
                    <SquareCheckBig className="h-4 w-4" /> Task
                  </Button>
                  <Button
                    disabled={assistantReady === false}
                    onClick={() => setMode("ai")}
                    size="sm"
                    title={
                      assistantReady === false
                        ? "The study assistant is not configured on this deployment."
                        : undefined
                    }
                    variant="secondary"
                  >
                    <Bot className="h-4 w-4" />
                    AI
                    {assistantReady === false ? " · off" : null}
                  </Button>
                </>
              ) : mode === "ai" ? (
                <>
                  {STUDY_ASSISTANT_ACTIONS.map((action) => (
                    <Button
                      disabled={saving}
                      key={action.key}
                      onClick={() => ask(action.key)}
                      size="sm"
                      variant={
                        aiAction === action.key ? "primary" : "secondary"
                      }
                    >
                      {saving && aiAction === action.key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      {action.label}
                    </Button>
                  ))}
                  {aiAnswer ? (
                    <Button disabled={saving} onClick={keepAnswer} size="sm">
                      <NotebookPen className="h-4 w-4" /> Keep as note
                    </Button>
                  ) : null}
                  <Button
                    disabled={saving}
                    onClick={() => {
                      setMode(null);
                      setAiAnswer("");
                      setAiAction(null);
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    Back
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    disabled={saving}
                    onClick={() => save(mode === "task")}
                    size="sm"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {mode === "task" ? "Create task" : "Save note"}
                  </Button>
                  <Button
                    disabled={saving}
                    onClick={() => setMode(null)}
                    size="sm"
                    variant="ghost"
                  >
                    Back
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
