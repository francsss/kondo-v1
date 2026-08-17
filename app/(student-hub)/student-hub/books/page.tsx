import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatEssentialPrice } from "@/lib/study-essentials";
import { isBooksPilotMode } from "@/lib/payments/registry";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { listEntitledEssentials } from "@/lib/study-entitlements";
import { BuyBookButton } from "@/components/features/student-hub/BuyBookButton";
import { BooksPageAnalytics } from "@/components/features/student-hub/BooksPageAnalytics";

export const metadata: Metadata = {
  title: "Books — Student Hub",
  description: "Read your course books and set texts inside Kondo.",
};

export const dynamic = "force-dynamic";

/**
 * Books, and the ones you already own.
 *
 * My Books leads, because someone opening this page has usually come back to
 * carry on reading rather than to shop. The store follows, with titles the
 * member already owns filtered out of it.
 */
export default async function BooksPage() {
  const user = await requireUser();
  const [owned, catalogue] = await Promise.all([
    listEntitledEssentials(user.id),
    prisma.studyEssential.findMany({
      where: { status: "PUBLISHED", deliveryType: { in: ["EPUB", "PDF"] } },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        author: true,
        shortDescription: true,
        coverEmoji: true,
        priceMinor: true,
        currency: true,
        source: true,
      },
      take: 40,
    }),
  ]);

  const ownedIds = new Set(owned.map((book) => book.id));
  const forSale = catalogue.filter((book) => !ownedIds.has(book.id));
  const pilot = isBooksPilotMode();

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-28 pt-6 sm:px-6 lg:pb-16">
      <BooksPageAnalytics ownedCount={owned.length} />
      <PageHeader
        description="Your set texts and course books, readable on your phone with your highlights and notes kept."
        eyebrow="Student Hub"
        title="Books"
      />

      <section className="mt-7">
        <h2 className="text-xl font-black tracking-[-0.02em]">My Books</h2>
        {owned.length ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {owned.map((book) => (
              <Card className="flex flex-col p-5" key={book.id}>
                <span className="text-3xl">{book.coverEmoji ?? "📖"}</span>
                <h3 className="mt-3 font-black leading-snug">{book.title}</h3>
                {book.author ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {book.author}
                  </p>
                ) : null}
                <p className="mt-3 text-xs font-bold text-muted-foreground">
                  {book.percentage > 0
                    ? `${book.percentage}% completed`
                    : "Not started"}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-kondo-green"
                    style={{ width: `${book.percentage}%` }}
                  />
                </div>
                <Button asChild className="mt-4" fullWidth>
                  <Link href={`/student-hub/books/${book.slug}`}>
                    <BookOpen className="h-4 w-4" />
                    {book.percentage > 0 ? "Continue reading" : "Start reading"}
                  </Link>
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mt-4 py-12 text-center">
            <p className="text-3xl">📚</p>
            <p className="mt-3 font-black">No books yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Books you buy or are given appear here, and open where you left
              off.
            </p>
          </Card>
        )}
      </section>

      {forSale.length ? (
        <section className="mt-10">
          <h2 className="text-xl font-black tracking-[-0.02em]">
            Available books
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {forSale.map((book) => {
              const free = (book.priceMinor ?? 0) === 0;
              return (
                <Card className="flex flex-col p-5" key={book.id}>
                  <span className="text-3xl">{book.coverEmoji ?? "📖"}</span>
                  <h3 className="mt-3 font-black leading-snug">{book.title}</h3>
                  {book.author ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {book.author}
                    </p>
                  ) : null}
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                    {book.shortDescription}
                  </p>
                  <p className="mt-3 text-lg font-black">
                    {free
                      ? "Free"
                      : formatEssentialPrice(book.priceMinor, book.currency)}
                  </p>
                  {/*
                   * Said plainly rather than buried. The pilot title is a
                   * public-domain work and its price is a sandbox figure, so
                   * presenting it as a normal purchase would misrepresent it.
                   */}
                  {!free && pilot ? (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                      <Sparkles className="h-3 w-3" />
                      Sandbox test purchase — no real money is taken
                    </p>
                  ) : null}
                  <div className="mt-4">
                    {free ? (
                      <Button asChild fullWidth>
                        <Link href={`/student-hub/books/${book.slug}`}>
                          <BookOpen className="h-4 w-4" /> Read now
                        </Link>
                      </Button>
                    ) : (
                      <BuyBookButton
                        disabled={!pilot}
                        slug={book.slug}
                        title={book.title}
                      />
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
