import type { Metadata } from "next";
import {
  LibraryShelf,
  ShelfHeader,
} from "@/components/features/student-hub/LibraryShelf";
import { requireUser } from "@/lib/server-auth";
import { listLibrary } from "@/lib/study-workspace";

export const metadata: Metadata = {
  title: "My Library — Study Essentials",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudyLibraryPage() {
  const user = await requireUser();
  const library = await listLibrary(user.id);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <ShelfHeader
        description="Everything you have acquired, in one place. Digital titles open in the reader, where you can highlight passages, keep notes and raise tasks straight into your planner."
        title="My Library"
      />
      <LibraryShelf
        emptyBody="Anything you acquire from Study Resources arrives here automatically, ready to open."
        emptyTitle="Your library is empty"
        entries={library}
      />
    </div>
  );
}
