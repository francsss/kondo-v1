import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StudyReader } from "@/components/features/student-hub/StudyReader";
import { requireUser } from "@/lib/server-auth";
import { StudyEssentialError } from "@/lib/study-essentials";
import { getReadableEssential } from "@/lib/study-workspace";

export const metadata: Metadata = {
  title: "Reading — Study Essentials",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudyReaderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const slug = (await params).slug;

  let loaded: Awaited<ReturnType<typeof getReadableEssential>>;
  try {
    loaded = await getReadableEssential(user.id, slug);
  } catch (error) {
    // Not owned: send the student to the product rather than to a dead end.
    if (error instanceof StudyEssentialError && error.status === 403) {
      redirect(`/student-hub/essentials/${slug}`);
    }
    throw error;
  }
  if (!loaded) notFound();

  const { essential, progress, notes } = loaded;

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <Link
        className="inline-flex items-center gap-2 text-sm font-black text-muted-foreground transition hover:text-kondo-green"
        href="/student-hub/essentials/library"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        My Library
      </Link>

      <h1 className="mt-5 text-balance font-display text-3xl font-black leading-[1.1] tracking-[-0.04em] sm:text-4xl">
        {essential.title}
      </h1>

      <div className="mt-6">
        <StudyReader
          chapters={essential.chapters}
          initialChapterId={progress?.chapterId ?? null}
          initialNotes={notes.map((note) => ({
            id: note.id,
            chapterId: note.chapterId,
            highlight: note.highlight,
            body: note.body,
            taskId: note.taskId,
          }))}
          slug={essential.slug}
          title={essential.title}
        />
      </div>
    </div>
  );
}
