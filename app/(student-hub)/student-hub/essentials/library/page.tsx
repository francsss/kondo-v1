import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Library } from "lucide-react";
import {
  LibraryShelf,
  ShelfHeader,
} from "@/components/features/student-hub/LibraryShelf";
import { requireUser } from "@/lib/server-auth";
import { listOwnedLibrary } from "@/lib/study-library";

export const metadata: Metadata = {
  title: "My Library — Study Essentials",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Everything the member owns, on one shelf.
 *
 * This used to be three tabs — everything, digital books, purchased materials
 * — which are the same list filtered three ways, and none of them could show
 * an EPUB: the digital shelf required chapter rows, which a book stored as a
 * file does not have. Books bought through the newer entitlement path sat in a
 * second shelf with no route to it from the hub.
 *
 * One page, with the part a student came back for at the top. A book being
 * read is the reason someone opens this screen; the rest is a shelf.
 */
export default async function StudyLibraryPage() {
  const user = await requireUser();
  const items = await listOwnedLibrary(user.id);

  const reading = items
    .filter((item) => item.readable && item.percentage > 0)
    .sort(
      (first, second) =>
        (second.lastReadAt?.getTime() ?? 0) -
        (first.lastReadAt?.getTime() ?? 0),
    );
  const readingIds = new Set(reading.map((item) => item.id));
  const books = items.filter(
    (item) => item.readable && !readingIds.has(item.id),
  );
  const materials = items.filter((item) => !item.readable);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <ShelfHeader
        description="Everything you own, and the book you had open last."
        title="My Library"
      />

      {items.length === 0 ? (
        <div className="mt-8 rounded-[2rem] border border-dashed border-border p-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Library aria-hidden="true" className="h-6 w-6" />
          </span>
          <p className="mt-4 font-black">Your library is empty</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Books and study material you get through Kondo arrive here, and open
            where you left off.
          </p>
          <Link
            className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-sm font-black text-primary-foreground transition hover:bg-primary/90"
            href="/student-hub/essentials"
          >
            Browse Study Essentials
          </Link>
        </div>
      ) : null}

      {reading.length ? (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-black tracking-[-0.02em]">
            <BookOpen aria-hidden="true" className="h-4 w-4 text-kondo-green" />
            Continue reading
          </h2>
          <LibraryShelf items={reading} showProgress />
        </section>
      ) : null}

      {books.length ? (
        <section className="mt-10">
          <h2 className="text-lg font-black tracking-[-0.02em]">
            {reading.length ? "Other books" : "Books"}
          </h2>
          <LibraryShelf items={books} />
        </section>
      ) : null}

      {materials.length ? (
        <section className="mt-10">
          <h2 className="text-lg font-black tracking-[-0.02em]">Materials</h2>
          <LibraryShelf items={materials} />
        </section>
      ) : null}
    </div>
  );
}
