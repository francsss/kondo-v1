import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { StudyEssentialCover } from "@/components/features/student-hub/StudyEssentialCover";
import type { LibraryItem } from "@/lib/study-library";

/**
 * One section of My Library.
 *
 * Every card knows where it opens before it gets here — an EPUB to the EPUB
 * reader, a text title to the chapter reader, anything else to its product
 * page — because that decision belongs to one function rather than to each
 * surface that draws a shelf.
 */
export function LibraryShelf({
  items,
  showProgress = false,
}: {
  items: LibraryItem[];
  showProgress?: boolean;
}) {
  if (!items.length) return null;

  return (
    <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <li className="min-w-0" key={item.id}>
          <Link
            className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-border bg-card transition hover:-translate-y-0.5 hover:border-kondo-green/50 hover:shadow-lift motion-reduce:transform-none"
            href={item.href}
          >
            <StudyEssentialCover
              className="aspect-[4/3] w-full"
              coverEmoji={item.coverEmoji}
              emojiClassName="text-6xl transition duration-500 group-hover:scale-110 motion-reduce:transform-none"
              imageUrl={item.imageUrl}
              slug={item.slug}
              title={item.title}
            />
            <span className="flex flex-1 flex-col p-4">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">
                  {item.format === "DIGITAL" ? "Digital" : "Physical"}
                </span>
                {/* Chapter counts only mean something for a title Kondo stores
                    as chapters. An EPUB's structure lives inside the file. */}
                {item.chapterCount > 0 ? (
                  <span className="rounded-full bg-kondo-mint px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
                    {item.chapterCount} chapters
                  </span>
                ) : null}
              </span>
              <span className="mt-2.5 line-clamp-2 font-black leading-snug group-hover:text-kondo-green">
                {item.title}
              </span>

              {showProgress ? (
                <>
                  <span className="mt-2 text-xs font-bold text-muted-foreground">
                    {item.percentage}% read
                  </span>
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                  >
                    <span
                      className="block h-full rounded-full bg-kondo-green"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </span>
                </>
              ) : (
                <span className="mt-1.5 text-xs text-muted-foreground">
                  Added{" "}
                  {new Intl.DateTimeFormat("en", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }).format(item.acquiredAt)}
                </span>
              )}

              <span className="mt-4 inline-flex items-center gap-1 text-xs font-black text-kondo-green">
                {item.readable ? (
                  <>
                    {showProgress ? "Continue" : "Open"}{" "}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </>
                ) : (
                  "View details"
                )}
              </span>
            </span>
          </Link>
        </li>
      ))}
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
