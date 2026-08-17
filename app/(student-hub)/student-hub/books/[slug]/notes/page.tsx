import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Bookmark, Highlighter } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { checkEntitlement } from "@/lib/study-entitlements";
import { getReadingState } from "@/lib/study-reading";

export const metadata: Metadata = { title: "Notes & Highlights" };
export const dynamic = "force-dynamic";

/**
 * Everything a member has marked in one book, on its own page.
 *
 * The reader has a panel for this, but a panel is for glancing while reading.
 * Revision is a different activity — done away from the book, often on a
 * laptop, and it wants a page you can scroll and link to. Each entry links
 * back into the book at its own locator, so the list is a way in rather than
 * a copy of the text.
 */
export default async function BookNotesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;

  const essential = await prisma.studyEssential.findUnique({
    where: { slug },
    select: { id: true, title: true },
  });
  if (!essential) notFound();

  const entitlement = await checkEntitlement({
    userId: user.id,
    essentialId: essential.id,
  });
  if (!entitlement.allowed) redirect("/student-hub/books");

  const state = await getReadingState(user.id, slug);
  const readerHref = `/student-hub/books/${slug}`;

  return (
    <div className="mx-auto max-w-[760px] px-4 pb-28 pt-6 sm:px-6 lg:pb-16">
      <Button asChild size="sm" variant="ghost">
        <Link href={readerHref}>
          <ArrowLeft className="h-4 w-4" /> Back to the book
        </Link>
      </Button>
      <div className="mt-3">
        <PageHeader
          description={essential.title}
          eyebrow="Student Hub"
          title="Notes & Highlights"
        />
      </div>

      <section className="mt-7">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <Highlighter className="h-4 w-4 text-kondo-green" />
          Highlights and notes
        </h2>
        {state.notes.length ? (
          <ul className="mt-3 space-y-3">
            {state.notes.map((note) => (
              <li key={note.id}>
                <Card className="p-4">
                  {note.highlight ? (
                    <blockquote className="border-l-2 border-kondo-green pl-3 text-sm leading-6">
                      {note.highlight}
                    </blockquote>
                  ) : null}
                  {note.body ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {note.body}
                    </p>
                  ) : null}
                  {note.locator ? (
                    <Button asChild className="mt-3" size="sm" variant="ghost">
                      <Link
                        href={`${readerHref}?at=${encodeURIComponent(note.locator)}`}
                      >
                        Open in the book
                      </Link>
                    </Button>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="mt-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Select any passage while reading to highlight it or write a note.
            </p>
          </Card>
        )}
      </section>

      <section className="mt-9">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <Bookmark className="h-4 w-4 text-kondo-green" />
          Bookmarks
        </h2>
        {state.bookmarks.length ? (
          <ul className="mt-3 space-y-2">
            {state.bookmarks.map((mark) => (
              <li key={mark.id}>
                <Link
                  className="block rounded-2xl border border-border p-3 text-sm font-bold transition hover:border-kondo-green/40"
                  href={`${readerHref}?at=${encodeURIComponent(mark.locator)}`}
                >
                  {mark.label ?? "Bookmark"}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="mt-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Bookmark a page from the reader to keep your place.
            </p>
          </Card>
        )}
      </section>
    </div>
  );
}
