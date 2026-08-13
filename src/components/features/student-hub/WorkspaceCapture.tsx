"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ListTodo, Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The one primary action of a course Workspace, and everything else folded
 * behind a single `+ Add`.
 *
 * The brief is explicit that Write Note, Voice Note, Photo, Document, Task and
 * Ask AI must not all sit on the screen at once. Only Task is wired here,
 * because only Task has a real endpoint today — `POST /api/student-hub/tasks`,
 * the same one the Planner uses. The rest are deliberately absent rather than
 * present and dead: a button that does nothing is worse than no button.
 *
 * The course is already known, so the student is never asked which course this
 * belongs to. `courseId` goes straight onto the task, which is what makes it
 * appear in Planner → Tasks without a second task system existing.
 */
export function WorkspaceCapture({
  courseId,
  courseName,
  resume = null,
}: {
  courseId: string;
  courseName: string;
  /** The book this course is being read from, if one is linked. */
  resume?: { slug: string; title: string; chapterLabel: string | null } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/student-hub/tasks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, title: trimmed }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error ?? "The task was not saved.");
        return;
      }
      setTitle("");
      setSaved(true);
      setOpen(false);
      // The list on this page is server-rendered, so ask for it again rather
      // than keeping a second copy of the task in client state.
      router.refresh();
      window.setTimeout(() => setSaved(false), 2400);
    } catch {
      setError("The task was not saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6">
      {/*
       * The primary action follows the work. With a book linked it resumes
       * that book at the saved chapter; without one there is nothing honest to
       * continue, so `+ Add` becomes the way forward instead of a button that
       * leads nowhere.
       */}
      {resume ? (
        <Link
          className="mb-2 flex items-center gap-3 rounded-2xl border border-kondo-green/40 bg-kondo-mint p-3.5 transition active:scale-[0.99] dark:bg-emerald-400/10 motion-reduce:active:scale-100"
          href={`/student-hub/essentials/read/${resume.slug}`}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-black text-foreground">
              {resume.title}
            </span>
            {resume.chapterLabel ? (
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {resume.chapterLabel}
              </span>
            ) : null}
          </span>
          <span className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-kondo-green px-4 text-xs font-black text-white">
            {resume.chapterLabel ? "Continue reading" : "Start reading"}
          </span>
        </Link>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-border bg-card px-6 text-sm font-black text-foreground transition active:scale-[0.99] motion-reduce:active:scale-100"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          Add to this course
        </button>
        <button
          aria-expanded={open}
          aria-label={open ? "Close add menu" : "Add to this course"}
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-full border transition",
            open
              ? "border-kondo-green bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300"
              : "border-border bg-card text-foreground hover:border-kondo-green/40",
          )}
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? (
            <X aria-hidden="true" className="h-5 w-5" />
          ) : (
            <Plus aria-hidden="true" className="h-5 w-5" />
          )}
        </button>
      </div>

      {saved ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-kondo-forest dark:text-emerald-300">
          <Check aria-hidden="true" className="h-3.5 w-3.5" />
          Added to Planner
        </p>
      ) : null}

      {open ? (
        <form
          className="animate-sheet-in mt-3 rounded-2xl border border-border bg-card p-3 motion-reduce:animate-none"
          onSubmit={createTask}
        >
          <label className="flex items-center gap-2">
            <ListTodo
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-kondo-green"
            />
            <span className="sr-only">Task for {courseName}</span>
            <input
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              enterKeyHint="done"
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={`Add a task for ${courseName}`}
              value={title}
            />
            <button
              className="inline-flex min-h-9 shrink-0 items-center rounded-full bg-kondo-green px-3.5 text-xs font-black text-white disabled:opacity-50"
              disabled={!title.trim() || saving}
              type="submit"
            >
              {saving ? (
                <Loader2
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                />
              ) : (
                "Add"
              )}
            </button>
          </label>
          {error ? (
            <p className="mt-2 text-xs font-bold text-destructive">{error}</p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
