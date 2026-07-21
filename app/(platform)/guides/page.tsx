import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, Search } from "lucide-react";
import { GuideCard } from "@/components/features/guides/GuideCard";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { getGuideLibrary } from "@/lib/platform-queries";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Student guides" };

const categories = [
  { label: "All guides", value: undefined },
  { label: "Before departure", value: "BEFORE_DEPARTURE" },
  { label: "Arrival", value: "ARRIVAL" },
  { label: "Residency", value: "RESIDENCY" },
  { label: "Daily life", value: "DAILY_LIFE" },
  { label: "Money", value: "MONEY" },
  { label: "Health", value: "HEALTH" },
] as const;

export default async function GuidesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; saved?: string }>;
}) {
  const user = await requireUser();
  const { category: selectedCategory, q = "", saved } = await searchParams;
  const guides = await getGuideLibrary(user.id);
  const visibleGuides = guides.filter(
    (guide) =>
      (!selectedCategory || guide.category === selectedCategory) &&
      (!saved || guide.bookmarked) &&
      (!q ||
        guide.title.toLowerCase().includes(q.toLowerCase()) ||
        guide.summary.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        action={
          <Button asChild variant="secondary">
            <Link href={saved ? "/guides" : "/guides?saved=1"}>
              <Bookmark className="h-4 w-4" />
              {saved ? "All guides" : "Saved guides"}
            </Link>
          </Button>
        }
        description="Clear, student-tested checklists for the moments that usually feel complicated—from packing to your residence permit."
        eyebrow="Know what comes next"
        title="Student guides"
      />

      <section className="noise relative mt-8 overflow-hidden rounded-4xl bg-gradient-to-br from-[#f2ffe7] via-kondo-mint to-emerald-100 p-7 dark:from-emerald-950/30 dark:via-[#16251f] dark:to-lime-950/20 sm:p-10">
        <div className="relative z-10 max-w-2xl">
          <span className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-black text-kondo-forest dark:bg-white/10 dark:text-emerald-300">
            Start here
          </span>
          <h2 className="mt-5 text-balance text-3xl font-black tracking-[-0.04em] text-kondo-ink dark:text-white sm:text-4xl">
            China feels easier when someone shows you the steps.
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Every guide is written around real student tasks, with short steps
            you can finish and save as you go.
          </p>
          <form className="mt-6 flex h-12 max-w-md items-center gap-3 rounded-2xl bg-white px-4 shadow-sm dark:bg-white/10">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              aria-label="Search guides"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              defaultValue={q}
              name="q"
              placeholder="What do you need help with?"
            />
            {selectedCategory ? (
              <input name="category" type="hidden" value={selectedCategory} />
            ) : null}
          </form>
        </div>
        <div
          aria-hidden="true"
          className="absolute -bottom-10 right-8 hidden text-[160px] leading-none opacity-90 lg:block"
        >
          🧭
        </div>
      </section>

      <div className="scrollbar-none mt-7 flex gap-2 overflow-x-auto pb-1">
        {categories.map((category) => (
          <Link
            className={
              selectedCategory === category.value ||
              (!selectedCategory && !category.value)
                ? "whitespace-nowrap rounded-full bg-kondo-ink px-4 py-2 text-sm font-bold text-white dark:bg-emerald-400 dark:text-kondo-ink"
                : "whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-muted-foreground dark:border-white/10 dark:bg-white/5 dark:text-muted-foreground"
            }
            href={
              category.value ? `/guides?category=${category.value}` : "/guides"
            }
            key={category.label}
          >
            {category.label}
          </Link>
        ))}
      </div>

      <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {visibleGuides.map((guide) => (
          <GuideCard guide={guide} key={guide.id} />
        ))}
      </section>
    </div>
  );
}
