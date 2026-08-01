import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  BookOpenCheck,
  CalendarDays,
  Compass,
  ListTodo,
  MessageCircleQuestion,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { GuideCard } from "@/components/features/guides/GuideCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getGuideLibrary } from "@/lib/platform-queries";
import { studentHubAccessForJourney } from "@/lib/personal-journeys";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { deriveTodayCourses } from "@/lib/student-academic-tools";

export const metadata: Metadata = { title: "Study — Student Hub" };

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
  const plannerAvailable = studentHubAccessForJourney(
    user.studentJourney,
    Boolean(user.universityId),
  ).academicTools;
  const now = new Date();
  const [guides, schedule, pendingTaskCount, nextDeadline] = await Promise.all([
    getGuideLibrary(user.id),
    plannerAvailable
      ? prisma.studentSchedule.findFirst({
          where: { ownerId: user.id, isActive: true },
          select: {
            id: true,
            timezone: true,
            courses: {
              select: {
                id: true,
                dayOfWeek: true,
                startTime: true,
                endTime: true,
                startPeriod: true,
                endPeriod: true,
              },
            },
          },
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve(null),
    plannerAvailable
      ? prisma.academicTask.count({
          where: {
            ownerId: user.id,
            status: { in: ["PENDING", "IN_PROGRESS"] },
          },
        })
      : Promise.resolve(0),
    plannerAvailable
      ? prisma.academicTask.findFirst({
          where: {
            ownerId: user.id,
            status: { in: ["PENDING", "IN_PROGRESS"] },
            dueAt: { gte: now },
          },
          select: { dueAt: true },
          orderBy: { dueAt: "asc" },
        })
      : Promise.resolve(null),
  ]);
  const classesToday = schedule
    ? deriveTodayCourses(schedule.courses, now, schedule.timezone).today.length
    : 0;
  const journeyPriority =
    user.studentJourney === "INCOMING_STUDENT" ||
    user.studentJourney === "ADMITTED_STUDENT" ||
    user.studentJourney === "PROSPECTIVE_STUDENT"
      ? ["BEFORE_DEPARTURE", "ARRIVAL", "RESIDENCY", "HEALTH"]
      : user.studentJourney === "ALUMNI" ||
          user.studentJourney === "PROFESSIONAL"
        ? ["MONEY", "UNIVERSITY", "DAILY_LIFE"]
        : ["UNIVERSITY", "DAILY_LIFE", "HEALTH", "TRANSPORT"];
  const visible = guides
    .filter(
      (guide) =>
        (!category || guide.category === category) &&
        (!saved || guide.bookmarked) &&
        (!q ||
          `${guide.title} ${guide.summary}`
            .toLowerCase()
            .includes(q.toLowerCase())),
    )
    .sort((left, right) => {
      const leftRank = journeyPriority.indexOf(left.category);
      const rightRank = journeyPriority.indexOf(right.category);
      return (
        (leftRank < 0 ? journeyPriority.length : leftRank) -
        (rightRank < 0 ? journeyPriority.length : rightRank)
      );
    });
  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      <section className="noise relative overflow-hidden rounded-4xl bg-gradient-to-br from-kondo-navy via-kondo-forest to-emerald-700 p-7 text-white shadow-lift sm:p-10">
        <div className="relative z-10 max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-kondo-lime">
            Student Hub · Study
          </p>
          <h1 className="mt-3 text-balance text-3xl font-black tracking-[-0.045em] sm:text-5xl">
            Your studies, organized around you.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/72">
            Plan classes and deadlines, find trusted guidance, and ask students
            who have already been there.
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
      <section
        aria-label="Study workspace"
        className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]"
      >
        <Card className="overflow-hidden bg-gradient-to-br from-card via-card to-kondo-mint/40">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
                {plannerAvailable ? "Your study day" : "Prepare with Kondo"}
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">
                {plannerAvailable
                  ? `Good day, ${user.firstName}.`
                  : "Build your study plan with trusted context."}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                {plannerAvailable
                  ? "Your timetable and coursework stay together, so the next useful action is always close."
                  : "Explore practical guides and ask the student community while you prepare for your next academic step."}
              </p>
            </div>
            {plannerAvailable ? (
              <Button asChild>
                <Link href="/student-hub/tools">
                  Open planner <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
          {plannerAvailable ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <StudyMetric
                icon={CalendarDays}
                label="Classes today"
                value={String(classesToday)}
              />
              <StudyMetric
                icon={ListTodo}
                label="Pending tasks"
                value={String(pendingTaskCount)}
              />
              <StudyMetric
                icon={Sparkles}
                label="Next deadline"
                value={
                  nextDeadline?.dueAt
                    ? nextDeadline.dueAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })
                    : "Clear"
                }
              />
            </div>
          ) : null}
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StudyLink
            description="Practical, student-tested guidance for university and daily life."
            href="#guides"
            icon={BookOpenCheck}
            title="Study guides"
          />
          <StudyLink
            description="Ask clearly and learn from students across Kondo."
            href="/student-hub/help"
            icon={MessageCircleQuestion}
            title="Student Q&A"
          />
        </div>
      </section>
      <div className="scroll-mt-36 pt-9" id="guides">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
          Study library
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">
          Guides for the part you are in now
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Search by topic or keep the guides you want to return to.
        </p>
      </div>
      <div className="mt-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <nav
          aria-label="Student Hub guide categories"
          className="subnav-row flex-1 gap-2 pb-1"
        >
          {categories.map(([label, value]) => (
            <Link
              className={
                (category ?? "") === value
                  ? "rounded-2xl bg-kondo-ink px-3 py-2.5 text-center text-xs font-black text-white dark:bg-emerald-400 dark:text-kondo-ink sm:text-sm"
                  : "rounded-2xl border border-border bg-card px-3 py-2.5 text-center text-xs font-bold text-muted-foreground transition hover:-translate-y-0.5 hover:border-kondo-green sm:text-sm"
              }
              href={value ? `/student-hub?category=${value}` : "/student-hub"}
              key={label}
            >
              {label}
            </Link>
          ))}
        </nav>
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

function StudyMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/75 p-4">
      <Icon className="h-4 w-4 text-kondo-green" />
      <p className="mt-3 text-xl font-black">{value}</p>
      <p className="mt-1 text-xs font-bold text-muted-foreground">{label}</p>
    </div>
  );
}

function StudyLink({
  description,
  href,
  icon: Icon,
  title,
}: {
  description: string;
  href: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <Link
      className="group rounded-3xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-kondo-green/40 hover:shadow-md"
      href={href}
      scroll={href.startsWith("#")}
    >
      <div className="flex items-start gap-4">
        <span className="rounded-2xl bg-kondo-mint p-2.5 text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-black">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-kondo-green">
            Open{" "}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
