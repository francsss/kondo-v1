"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Compass,
  GraduationCap,
  Library,
  NotebookPen,
} from "lucide-react";
import { ProductAnalyticsIdentity } from "@/components/analytics/ProductAnalytics";
import { PresenceHeartbeat } from "@/components/app/PresenceHeartbeat";
import { KondoPet } from "@/components/features/feedback/KondoPet";
import {
  HorizontalTabs,
  TabPanelTransition,
  type HorizontalTab,
} from "@/components/ui/HorizontalTabs";
import { studentHubAccessForJourney } from "@/lib/personal-journeys";
import { cn } from "@/lib/utils";
import { STUDENT_HUB_SECTIONS } from "@/lib/student-hub-sections";

const kondoPetEnabled = process.env.NEXT_PUBLIC_KONDO_PET_ENABLED !== "false";

const STUDENT_HUB_MODULES: readonly HorizontalTab[] = [
  {
    key: "studies",
    href: "/student-hub",
    label: "Studies",
  },
  {
    key: "resources",
    href: "/student-hub/resources",
    label: "Resources",
  },
  {
    key: "opportunities",
    href: "/student-hub/scholarships",
    label: "Opportunities",
  },
];

const STUDENT_HUB_PILLARS = [
  {
    key: "studies",
    href: "/student-hub",
    label: "Studies",
    description: "Your timetable, deadlines and questions.",
    icon: NotebookPen,
  },
  {
    key: "resources",
    href: "/student-hub/resources",
    label: "Resources",
    description: "Materials and guides that help you study.",
    icon: Library,
  },
  {
    key: "opportunities",
    href: "/student-hub/scholarships",
    label: "Opportunities",
    description: "Scholarships, internships, jobs and programmes.",
    icon: Compass,
  },
] as const;

const STUDY_TABS: readonly HorizontalTab[] = [
  {
    key: "overview",
    href: "/student-hub",
    label: "Overview",
  },
  {
    key: "tools",
    href: "/student-hub/tools",
    label: "Planner",
  },
  {
    key: "help",
    href: "/student-hub/help",
    label: "Student Q&A",
  },
];

/**
 * Student Hub navigation.
 *
 * The first level contains only the two mental models a student needs: doing
 * their studies and finding opportunities. The second level exposes the real
 * destinations inside the active module. Routes and source domains stay
 * unchanged; this is an information-architecture layer, not duplicated data.
 */
export type StudentHubModule = "studies" | "resources" | "opportunities";

export function studentHubModuleForPath(pathname: string): StudentHubModule {
  if (
    pathname === "/student-hub/resources" ||
    pathname.startsWith("/student-hub/resources/")
  ) {
    return "resources";
  }
  return STUDENT_HUB_SECTIONS.some(
    (section) =>
      section.key !== "overview" &&
      (pathname === section.href || pathname.startsWith(`${section.href}/`)),
  )
    ? "opportunities"
    : "studies";
}

export function studentHubTabsForModule(
  module: StudentHubModule,
  showAcademicTools: boolean,
): HorizontalTab[] {
  if (module === "studies") {
    return STUDY_TABS.filter((tab) => tab.key !== "tools" || showAcademicTools);
  }
  // Resources is a single destination today, so it needs no second level.
  if (module === "resources") return [];
  return STUDENT_HUB_SECTIONS.filter(
    (section) => section.key !== "overview",
  ).map((section) => ({
    key: section.key,
    href: section.href,
    label: section.label,
  }));
}

/**
 * Overview owns the hub root and the guide reader; every other section owns its
 * own path prefix. Resolving the active tab here keeps the highlight correct on
 * nested routes such as a scholarship detail page.
 */
export function activeStudentHubTab(
  pathname: string,
  tabs: readonly HorizontalTab[],
): string | null {
  if (
    pathname === "/student-hub" ||
    pathname.startsWith("/student-hub/guide/")
  ) {
    return "overview";
  }
  const match = tabs
    .filter((tab) => tab.href !== "/student-hub")
    .filter(
      (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`),
    )
    .sort((left, right) => right.href.length - left.href.length)[0];
  return match?.key ?? null;
}

type StudentHubUser = {
  id: string;
  role: string;
  country?: { code: string; name: string } | null;
  city?: { slug: string; name: string } | null;
  university?: { slug: string; name: string } | null;
  studentJourney?: string | null;
  onboardingCompletedAt?: Date | null;
};

export function StudentHubShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: StudentHubUser;
}) {
  const pathname = usePathname();
  const access = studentHubAccessForJourney(
    user.studentJourney,
    Boolean(user.university),
  );
  const activeModule = studentHubModuleForPath(pathname);
  const tabs = studentHubTabsForModule(activeModule, access.academicTools);
  const activeKey = activeStudentHubTab(pathname, tabs);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.key === activeKey),
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PresenceHeartbeat />
      <ProductAnalyticsIdentity user={user} />
      {/* A slim, always-available way out. Just the arrow in a soft green
          circle — the hub identity belongs to the hero below, not here. */}
      <div className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <Link
            aria-label="Back to Kondo"
            className="group grid h-10 w-10 shrink-0 place-items-center rounded-full border border-kondo-green/25 bg-kondo-green/8 text-kondo-green shadow-[0_0_0_4px_rgb(var(--ring)/0.06)] transition duration-200 hover:bg-kondo-green/14 hover:shadow-[0_0_0_6px_rgb(var(--ring)/0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/home"
          >
            <ArrowLeft className="h-[18px] w-[18px] transition-transform duration-200 group-hover:-translate-x-0.5" />
          </Link>
          <HorizontalTabs
            activeKey={activeModule}
            ariaLabel="Student Hub modules"
            className="justify-end"
            tabs={STUDENT_HUB_MODULES}
          />
        </div>
      </div>

      {/* The entrance. Three equal pillars, none of them the identity of the
          hub on its own — the hub is the academic space that contains them. */}
      <header className="relative overflow-hidden border-b border-border/60">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-kondo-mint/70 via-background to-background dark:from-emerald-400/10 dark:via-background dark:to-background"
        />
        <div aria-hidden="true" className="noise absolute inset-0 opacity-70" />
        <div className="relative mx-auto max-w-[1440px] px-4 pb-7 pt-8 sm:px-6 sm:pb-9 sm:pt-11 lg:px-8">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-kondo-green text-white shadow-lift"
            >
              <GraduationCap className="h-5 w-5" />
            </span>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-kondo-green">
              Student Hub
            </p>
          </div>

          {/* Deliberately not an <h1>: this banner is shared chrome, and each
              page inside the hub owns the document heading that describes it. */}
          <p className="mt-5 max-w-3xl font-display text-3xl font-black leading-[1.05] tracking-[-0.04em] sm:text-4xl lg:text-5xl">
            {user.university?.name
              ? `Your academic space at ${user.university.name}.`
              : "Your academic space."}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
            Everything for your studies in one place — your timetable and
            deadlines, the resources that help you, and the opportunities open
            to you.
          </p>

          <nav
            aria-label="Student Hub pillars"
            className="mt-7 grid gap-3 sm:mt-8 sm:grid-cols-3"
          >
            {STUDENT_HUB_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              const active = pillar.key === activeModule;
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-start gap-3 rounded-3xl border p-4 transition duration-200 hover:-translate-y-0.5 motion-reduce:transform-none sm:p-5",
                    active
                      ? "border-kondo-green/35 bg-card shadow-soft"
                      : "border-border/70 bg-card/55 hover:border-kondo-green/25 hover:bg-card",
                  )}
                  href={pillar.href}
                  key={pillar.key}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-2xl transition",
                      active
                        ? "bg-kondo-green text-white"
                        : "bg-muted text-muted-foreground group-hover:bg-kondo-mint group-hover:text-kondo-forest dark:group-hover:bg-emerald-400/10 dark:group-hover:text-emerald-200",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-black leading-tight">
                      {pillar.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {pillar.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {tabs.length ? (
        <div className="sticky top-[3.75rem] z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            <HorizontalTabs
              activeKey={activeKey}
              ariaLabel={`${
                activeModule === "studies" ? "Studies" : "Opportunity"
              } navigation`}
              className="py-1.5"
              tabs={tabs}
            />
          </div>
        </div>
      ) : null}
      <main>
        <TabPanelTransition index={activeIndex}>{children}</TabPanelTransition>
      </main>
      <KondoPet enabled={kondoPetEnabled} />
    </div>
  );
}
