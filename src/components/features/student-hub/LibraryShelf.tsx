import Link from "next/link";
import { ArrowUpRight, Library } from "lucide-react";
import { StudyEssentialCover } from "@/components/features/student-hub/StudyEssentialCover";
import type { listLibrary } from "@/lib/study-workspace";

type LibraryEntry = Awaited<ReturnType<typeof listLibrary>>[number];

/**
 * One shelf of My Library. The three shelves — everything, digital books and
 * purchased materials — are the same acquisitions filtered differently, so
 * they share this renderer instead of each growing their own card markup.
 */
export function LibraryShelf({
  entries,
  emptyTitle,
  emptyBody,
}: {
  entries: LibraryEntry[];
  emptyTitle: string;
  emptyBody: string;
}) {
  if (!entries.length) {
    return (
      <div className="mt-8 rounded-[2rem] border border-dashed border-border p-10 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <Library aria-hidden="true" className="h-6 w-6" />
        </span>
        <p className="mt-4 font-black">{emptyTitle}</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {emptyBody}
        </p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-sm font-black text-primary-foreground transition hover:bg-primary/90"
          href="/student-hub/essentials"
        >
          Browse Study Resources
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {entries.map(({ essential, placedAt }) => {
        const readable =
          essential.format === "DIGITAL" && essential._count.chapters > 0;
        return (
          <li className="min-w-0" key={essential.id}>
            <Link
              className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-border bg-card transition hover:-translate-y-0.5 hover:border-kondo-green/50 hover:shadow-lift motion-reduce:transform-none"
              href={
                readable
                  ? `/student-hub/essentials/read/${essential.slug}`
                  : `/student-hub/essentials/${essential.slug}`
              }
            >
              <StudyEssentialCover
                className="aspect-[4/3] w-full"
                coverEmoji={essential.coverEmoji}
                emojiClassName="text-6xl transition duration-500 group-hover:scale-110 motion-reduce:transform-none"
                imageUrl={essential.imageUrl}
                slug={essential.slug}
                title={essential.title}
              />
              <span className="flex flex-1 flex-col p-4">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">
                    {essential.format === "DIGITAL" ? "Digital" : "Physical"}
                  </span>
                  {readable ? (
                    <span className="rounded-full bg-kondo-mint px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
                      {essential._count.chapters} chapters
                    </span>
                  ) : null}
                </span>
                <span className="mt-2.5 line-clamp-2 font-black leading-snug group-hover:text-kondo-green">
                  {essential.title}
                </span>
                <span className="mt-1.5 text-xs text-muted-foreground">
                  Added{" "}
                  {new Intl.DateTimeFormat("en", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }).format(placedAt)}
                </span>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-black text-kondo-green">
                  {readable ? (
                    <>
                      Open <ArrowUpRight className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    "View details"
                  )}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Shared page heading for the three library shelves. */
export function ShelfHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="max-w-3xl">
      <h1 className="text-balance font-display text-3xl font-black leading-[1.1] tracking-[-0.04em] sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 text-pretty text-sm leading-7 text-muted-foreground sm:text-base">
        {description}
      </p>
    </header>
  );
}
