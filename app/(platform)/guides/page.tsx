import type { Metadata } from "next";
import type { GuideCategory } from "@prisma/client";
import Link from "next/link";
import { Bookmark, Search } from "lucide-react";
import { GuideCard } from "@/components/features/guides/GuideCard";
import { GuideNextStepCard } from "@/components/features/guides/GuideNextStepCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getGuideNextStep, guideCategoryPriority } from "@/lib/guide-journey";
import { getUserJourney } from "@/lib/journey-service";
import { journeyStageLabel } from "@/lib/journey";
import { getGuideLibrary } from "@/lib/platform-queries";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Student guides" };

/*
 * Derived from the enum rather than typed out by hand. The hand-written list
 * this replaces was missing UNIVERSITY and TRANSPORT, so guides in those two
 * categories existed, appeared in the grid, and could never be filtered to —
 * the kind of gap a literal list acquires the moment the enum grows.
 */
const CATEGORY_LABELS: Record<GuideCategory, string> = {
  BEFORE_DEPARTURE: "Before departure",
  ARRIVAL: "Arrival",
  RESIDENCY: "Residency",
  UNIVERSITY: "University",
  MONEY: "Money",
  TRANSPORT: "Transport",
  DAILY_LIFE: "Daily life",
  HEALTH: "Health",
};

function isGuideCategory(value: string | undefined): value is GuideCategory {
  return Boolean(value && value in CATEGORY_LABELS);
}

export default async function GuidesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; saved?: string }>;
}) {
  const user = await requireUser();
  const { category, q = "", saved } = await searchParams;
  const selectedCategory = isGuideCategory(category) ? category : undefined;

  const [guides, journey] = await Promise.all([
    getGuideLibrary(user.id),
    getUserJourney(user.id),
  ]);
  // Needs the stage the call above resolves, so it follows rather than joins it.
  const nextStep = await getGuideNextStep({
    userId: user.id,
    stage: journey.stage,
  });

  const visibleGuides = guides.filter(
    (guide) =>
      (!selectedCategory || guide.category === selectedCategory) &&
      (!saved || guide.bookmarked) &&
      (!q ||
        guide.title.toLowerCase().includes(q.toLowerCase()) ||
        guide.summary.toLowerCase().includes(q.toLowerCase())),
  );

  /*
   * The library used to be one flat grid in publish order, which meant a
   * student two weeks from flying scrolled past the healthcare guide to find
   * the packing one. Grouping by category and ordering those groups by the
   * member's stage puts the relevant section first without hiding anything:
   * every category that has guides still gets a heading further down.
   */
  const priority = guideCategoryPriority(journey.stage);
  const grouped = new Map<GuideCategory, typeof visibleGuides>();
  for (const guide of visibleGuides) {
    const bucket = grouped.get(guide.category) ?? [];
    bucket.push(guide);
    grouped.set(guide.category, bucket);
  }
  const sections = [...grouped.entries()].sort(([left], [right]) => {
    const leftRank = priority.indexOf(left);
    const rightRank = priority.indexOf(right);
    return (
      (leftRank < 0 ? priority.length : leftRank) -
      (rightRank < 0 ? priority.length : rightRank)
    );
  });
  // Only meaningful when the reader has not narrowed the library themselves.
  const showsStageOrder = !selectedCategory && !q && !saved;

  const categoryTabs = [
    { label: "All guides", value: undefined },
    // Ordered by the member's stage too, so the first tabs are the useful ones.
    ...[...priority, ...(Object.keys(CATEGORY_LABELS) as GuideCategory[])]
      .filter((value, index, all) => all.indexOf(value) === index)
      .map((value) => ({ label: CATEGORY_LABELS[value], value })),
  ];

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

      {/*
       * Where you actually are, at the top, instead of a hero telling everyone
       * the same thing. Shown only when there is a genuine unfinished step —
       * a member who has finished everything gets the library, not a card
       * congratulating them on a guide they closed weeks ago.
       */}
      {nextStep ? (
        <section className="mt-8">
          <GuideNextStepCard step={nextStep} />
        </section>
      ) : (
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
          </div>
          <div
            aria-hidden="true"
            className="absolute -bottom-10 right-8 hidden text-[160px] leading-none opacity-90 lg:block"
          >
            🧭
          </div>
        </section>
      )}

      <Card className="mt-5 p-0">
        <form className="flex h-12 items-center gap-3 px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
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
          {saved ? <input name="saved" type="hidden" value="1" /> : null}
        </form>
      </Card>

      <nav aria-label="Guide categories" className="subnav-row mt-5 gap-2 pb-1">
        {categoryTabs.map((tab) => (
          <Link
            className={
              selectedCategory === tab.value ||
              (!selectedCategory && !tab.value)
                ? "rounded-2xl bg-kondo-ink px-3 py-2.5 text-center text-xs font-bold text-white transition duration-200 dark:bg-emerald-400 dark:text-kondo-ink sm:text-sm"
                : "rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-center text-xs font-bold text-muted-foreground transition duration-200 hover:-translate-y-0.5 hover:border-kondo-green dark:border-white/10 dark:bg-white/5 dark:text-muted-foreground sm:text-sm"
            }
            href={tab.value ? `/guides?category=${tab.value}` : "/guides"}
            key={tab.label}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {sections.length ? (
        sections.map(([sectionCategory, sectionGuides], index) => (
          <section className="mt-8" key={sectionCategory}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xl font-black tracking-[-0.02em] text-kondo-ink dark:text-white">
                {CATEGORY_LABELS[sectionCategory]}
              </h2>
              {showsStageOrder && index === 0 ? (
                <p className="text-xs font-bold text-muted-foreground">
                  First because you’re{" "}
                  {journeyStageLabel(journey.stage).toLowerCase()}
                </p>
              ) : null}
            </div>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {sectionGuides.map((guide) => (
                <GuideCard guide={guide} key={guide.id} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <Card className="mt-8 py-16 text-center">
          <p className="text-3xl">🧭</p>
          <p className="mt-3 font-black text-kondo-ink dark:text-white">
            {saved ? "Nothing saved yet" : "No guides match that"}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {saved
              ? "Save a guide from any guide page and it will wait for you here."
              : "Try a different search, or browse a category above."}
          </p>
        </Card>
      )}
    </div>
  );
}
