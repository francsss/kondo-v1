import type { Metadata } from "next";
import {
  LibraryShelf,
  ShelfHeader,
} from "@/components/features/student-hub/LibraryShelf";
import { requireUser } from "@/lib/server-auth";
import { listLibrary } from "@/lib/study-workspace";

export const metadata: Metadata = {
  title: "Digital Books — Study Essentials",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DigitalBooksPage() {
  const user = await requireUser();
  const library = await listLibrary(user.id);
  // A digital acquisition is only a book once it actually has chapters to read.
  const books = library.filter(
    (entry) =>
      entry.essential.format === "DIGITAL" &&
      entry.essential._count.chapters > 0,
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <ShelfHeader
        description="Your readable titles. Open one to read by chapter — Kondo remembers where you stopped, and any passage you select can become a highlight, a note or a task."
        title="Digital Books"
      />
      <LibraryShelf
        emptyBody="Digital titles you acquire open here, with their chapters and your notes."
        emptyTitle="No digital books yet"
        entries={books}
      />
    </div>
  );
}
