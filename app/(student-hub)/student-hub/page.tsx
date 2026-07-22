import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, Compass, Search, Sparkles } from "lucide-react";
import { GuideCard } from "@/components/features/guides/GuideCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getGuideLibrary } from "@/lib/platform-queries";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Student Guide" };

const categories = [
  ["All", ""],
  ["Before departure", "BEFORE_DEPARTURE"],
  ["Arrival", "ARRIVAL"],
  ["Residency", "RESIDENCY"],
  ["Daily life", "DAILY_LIFE"],
  ["Money", "MONEY"],
  ["Transport", "TRANSPORT"],
  ["Health", "HEALTH"],
  ["University", "UNIVERSITY"],
] as const;

export default async function StudentGuidePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; saved?: string }>;
}) {
  const user = await requireUser();
  const { category, q = "", saved } = await searchParams;
  const guides = await getGuideLibrary(user.id);
  const visible = guides.filter(
    (guide) =>
      (!category || guide.category === category) &&
      (!saved || guide.bookmarked) &&
      (!q ||
        `${guide.title} ${guide.summary}`
          .toLowerCase()
          .includes(q.toLowerCase())),
  );
  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      <section className="noise relative overflow-hidden rounded-4xl bg-gradient-to-br from-kondo-navy via-kondo-forest to-emerald-700 p-7 text-white shadow-lift sm:p-10">
        <div className="relative z-10 max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-kondo-lime">
            Student Guide
          </p>
          <h1 className="mt-3 text-balance text-3xl font-black tracking-[-0.045em] sm:text-5xl">
            China, one clear step at a time.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/72">
            Practical, student-tested guides for arriving, studying and building
            your life here.
          </p>
          <form className="mt-6 flex h-12 max-w-lg items-center gap-3 rounded-2xl bg-white px-4 text-kondo-ink shadow-lg">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              aria-label="Search guides"
              className="w-full bg-transparent text-sm outline-none"
              defaultValue={q}
              name="q"
              placeholder="Search guides and checklists"
            />
            {category ? (
              <input name="category" type="hidden" value={category} />
            ) : null}
          </form>
        </div>
        <Compass className="absolute -bottom-12 right-10 hidden h-56 w-56 rotate-12 text-white/8 lg:block" />
      </section>
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
          {categories.map(([label, value]) => (
            <Link
              className={
                (category ?? "") === value
                  ? "whitespace-nowrap rounded-full bg-kondo-ink px-4 py-2 text-sm font-black text-white dark:bg-emerald-400 dark:text-kondo-ink"
                  : "whitespace-nowrap rounded-full border border-border bg-card px-4 py-2 text-sm font-bold text-muted-foreground"
              }
              href={value ? `/student-hub?category=${value}` : "/student-hub"}
              key={label}
            >
              {label}
            </Link>
          ))}
        </div>
        <Button asChild size="sm" variant="secondary">
          <Link href={saved ? "/student-hub" : "/student-hub?saved=1"}>
            <Bookmark className="h-4 w-4" />
            {saved ? "All guides" : "Saved"}
          </Link>
        </Button>
      </div>
      <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((guide) => (
          <GuideCard
            guide={guide}
            hrefBase="/student-hub/guide"
            key={guide.id}
          />
        ))}
      </section>
      {!visible.length ? (
        <Card className="mt-6 py-16 text-center">
          <Sparkles className="mx-auto h-7 w-7 text-kondo-green" />
          <p className="mt-3 font-black">No guide matches this view yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try another category or search.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
