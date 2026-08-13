import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  GraduationCap,
  ListTodo,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { studentHubAccessForJourney } from "@/lib/personal-journeys";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { getWorkspaceToday } from "@/lib/study-workspace-today";

export const metadata: Metadata = { title: "Study — Student Hub" };
export const dynamic = "force-dynamic";

/**
 * Study Overview answers one question: what is happening in my academic life?
 *
 * It used to answer several. Below the academic summary sat the entire guide
 * library — nine journey categories, a search field, a saved filter and a grid
 * of cards about visas, arrival, housing and money. None of that was moved
 * anywhere, because none of it was unique: `/guides` renders the same
 * `getGuideLibrary` data through the same categories and the same card, and
 * Guide already links to it. The copy here was the duplicate, so Overview
 * stopped drawing it.
 */
export default async function StudyOverviewPage() {
  const user = await requireUser();
  const plannerAvailable = studentHubAccessForJourney(
    user.studentJourney,
    Boolean(user.universityId),
  ).academicTools;

  if (!plannerAvailable) {
    return (
      <div className="mx-auto max-w-[900px] px-4 pb-24 pt-4 sm:px-6 sm:pt-8 lg:px-8">
        <Header firstName={user.firstName} />
        <Card className="mt-5">
          <GraduationCap
            aria-hidden="true"
            className="h-6 w-6 text-kondo-green"
          />
          <p className="mt-3 font-black">Your academic space starts here.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your university and timetable, and Study fills in your classes,
            tasks and deadlines.
          </p>
          <Button asChild className="mt-4" size="sm">
            <Link href="/onboarding">Add your university</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const now = new Date();
  // The same projection Workspace uses, so "today" cannot disagree between the
  // two screens, and the counts come back alongside it rather than after it.
  const [workspace, pendingTaskCount, nextDeadline] = await Promise.all([
    getWorkspaceToday(user.id, now),
    prisma.academicTask.count({
      where: { ownerId: user.id, status: { in: ["PENDING", "IN_PROGRESS"] } },
    }),
    prisma.academicTask.findFirst({
      where: {
        ownerId: user.id,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueAt: { gte: now },
      },
      select: { dueAt: true },
      orderBy: { dueAt: "asc" },
    }),
  ]);

  const classesToday = workspace.today.length;
  const focus = workspace.current ?? workspace.next ?? workspace.today[0];

  return (
    <div className="mx-auto max-w-[900px] px-4 pb-24 pt-4 sm:px-6 sm:pt-8 lg:px-8">
      <Header firstName={user.firstName} />

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <StudyMetric
          icon={CalendarDays}
          label="Classes today"
          value={String(classesToday)}
        />
        <StudyMetric
          icon={ListTodo}
          label="Open tasks"
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

      {/* One obvious next action: the room where the studying happens. */}
      <Link
        className="mt-4 flex items-center gap-3 rounded-2xl border border-kondo-green/40 bg-kondo-mint p-4 transition active:scale-[0.99] dark:bg-emerald-400/10 motion-reduce:active:scale-100"
        href="/student-hub/workspace"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-black uppercase tracking-[0.12em] text-kondo-forest dark:text-emerald-300">
            Workspace
          </span>
          <span className="mt-1 block truncate text-base font-black text-foreground">
            {focus ? focus.courseName : "What to study now"}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {classesToday
              ? `${classesToday} ${classesToday === 1 ? "class" : "classes"} today`
              : "No classes today"}
          </span>
        </span>
        <ArrowRight
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-kondo-forest dark:text-emerald-300"
        />
      </Link>

      <Link
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground transition hover:text-kondo-green"
        href="/student-hub/tools"
      >
        Open Planner →
      </Link>
    </div>
  );
}

function Header({ firstName }: { firstName: string }) {
  return (
    <header>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
        Student Hub · Study
      </p>
      <h1 className="mt-1 text-2xl font-black tracking-[-0.035em] sm:text-3xl">
        Good day, {firstName}.
      </h1>
    </header>
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
    <div className="rounded-2xl border border-border bg-card p-4">
      <Icon aria-hidden="true" className="h-4 w-4 text-kondo-green" />
      <p className="mt-3 text-xl font-black">{value}</p>
      <p className="mt-1 text-xs font-bold text-muted-foreground">{label}</p>
    </div>
  );
}
