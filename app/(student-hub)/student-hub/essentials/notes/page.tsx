import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, NotebookPen, SquareCheckBig } from "lucide-react";
import { StudyEssentialCover } from "@/components/features/student-hub/StudyEssentialCover";
import { requireUser } from "@/lib/server-auth";
import { listStudyNotes } from "@/lib/study-workspace";

export const metadata: Metadata = {
  title: "Notes — Study Essentials",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudyNotesPage() {
  const user = await requireUser();
  const notes = await listStudyNotes(user.id);

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="max-w-3xl">
        <h1 className="text-balance font-display text-3xl font-black leading-[1.1] tracking-[-0.04em] sm:text-4xl">
          Notes
        </h1>
        <p className="mt-3 text-pretty text-sm leading-7 text-muted-foreground sm:text-base">
          Every passage you highlighted and everything you wrote about it, with
          the resource and chapter it came from. Notes that raised a task keep
          the link to your planner.
        </p>
      </header>

      {notes.length ? (
        <ul className="mt-8 grid gap-3">
          {notes.map((note) => (
            <li
              className="rounded-[1.5rem] border border-border bg-card p-4 sm:p-5"
              key={note.id}
            >
              <div className="flex items-center gap-3">
                <StudyEssentialCover
                  className="h-11 w-11 shrink-0 rounded-xl"
                  coverEmoji={note.essential.coverEmoji}
                  emojiClassName="text-lg"
                  imageUrl={note.essential.imageUrl}
                  slug={note.essential.slug}
                  title={note.essential.title}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">
                    {note.essential.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {note.chapter?.title ?? "No chapter"} ·{" "}
                    {new Intl.DateTimeFormat("en", {
                      day: "numeric",
                      month: "short",
                    }).format(note.createdAt)}
                  </p>
                </div>
                <Link
                  aria-label={`Open ${note.essential.title}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition hover:border-kondo-green hover:text-kondo-green"
                  href={`/student-hub/essentials/read/${note.essential.slug}`}
                >
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>

              {note.highlight ? (
                <blockquote className="mt-4 border-l-2 border-kondo-green pl-3.5 text-sm italic leading-6 text-muted-foreground">
                  {note.highlight}
                </blockquote>
              ) : null}
              {note.body ? (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                  {note.body}
                </p>
              ) : null}
              {note.task ? (
                <p className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-kondo-mint px-3 py-1.5 text-[11px] font-black text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
                  <SquareCheckBig aria-hidden="true" className="h-3 w-3" />
                  {note.task.title}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8 rounded-[2rem] border border-dashed border-border p-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <NotebookPen aria-hidden="true" className="h-6 w-6" />
          </span>
          <p className="mt-4 font-black">No notes yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Open a title from My Library and select any passage — you can keep
            it as a highlight, write a note, or turn it into a task.
          </p>
          <Link
            className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-sm font-black text-primary-foreground transition hover:bg-primary/90"
            href="/student-hub/essentials/library"
          >
            Open My Library
          </Link>
        </div>
      )}
    </div>
  );
}
