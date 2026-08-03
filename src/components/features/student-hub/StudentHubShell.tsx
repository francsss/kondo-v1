"use client";

import { usePathname } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { ProductAnalyticsIdentity } from "@/components/analytics/ProductAnalytics";
import { PresenceHeartbeat } from "@/components/app/PresenceHeartbeat";
import { KondoPet } from "@/components/features/feedback/KondoPet";
import { BackButton } from "@/components/ui/BackButton";
import {
  HorizontalTabs,
  TabPanelTransition,
  type HorizontalTab,
} from "@/components/ui/HorizontalTabs";
import { studentHubAccessForJourney } from "@/lib/personal-journeys";
import { STUDENT_HUB_SECTIONS } from "@/lib/student-hub-sections";

const kondoPetEnabled = process.env.NEXT_PUBLIC_KONDO_PET_ENABLED !== "false";

/**
 * The three pillars of the hub. Each answers one student sentence: Study is
 * "I manage my academic life", Guide is "I get help navigating my journey",
 * Opportunities is "I build my future".
 */
const STUDENT_HUB_MODULES: readonly HorizontalTab[] = [
  {
    key: "study",
    href: "/student-hub",
    label: "Study",
    icon: "📚",
  },
  {
    key: "guide",
    href: "/student-hub/resources",
    label: "Guide",
    icon: "📖",
  },
  {
    key: "opportunities",
    href: "/student-hub/scholarships",
    label: "Opportunities",
    icon: "🚀",
  },
];

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
    key: "essentials",
    href: "/student-hub/essentials",
    label: "Study Essentials",
  },
];

/**
 * Guide is where a student goes for help with the journey rather than with a
 * course. Student Q&A moved here from Study for that reason; the routes
 * themselves are unchanged.
 */
const GUIDE_TABS: readonly HorizontalTab[] = [
  {
    key: "resource-home",
    href: "/student-hub/resources",
    label: "Overview",
  },
  {
    key: "help",
    href: "/student-hub/help",
    label: "Student Q&A",
  },
  {
    key: "guides",
    href: "/guides",
    label: "Guides",
  },
  {
    key: "stories",
    href: "/stories",
    label: "Student Stories",
  },
  {
    key: "communities",
    href: "/communities",
    label: "Communities",
  },
  {
    key: "housing",
    href: "/housing",
    label: "Housing",
  },
  {
    key: "city-resources",
    href: "/discover",
    label: "City resources",
  },
];

/**
 * Student Hub navigation.
 *
 * The first level contains the three stable mental models of the workspace.
 * The second level exposes only real destinations inside the active module.
 * Routes and source domains stay unchanged; this is an information-architecture
 * layer, not duplicated data.
 */
export type StudentHubModule = "study" | "guide" | "opportunities";

export function studentHubModuleForPath(pathname: string): StudentHubModule {
  if (
    pathname === "/student-hub/resources" ||
    pathname.startsWith("/student-hub/resources/") ||
    pathname === "/student-hub/help" ||
    pathname.startsWith("/student-hub/help/")
  ) {
    return "guide";
  }
  return STUDENT_HUB_SECTIONS.some(
    (section) =>
      section.key !== "overview" &&
      (pathname === section.href || pathname.startsWith(`${section.href}/`)),
  )
    ? "opportunities"
    : "study";
}

export function studentHubTabsForModule(
  module: StudentHubModule,
  showAcademicTools: boolean,
): HorizontalTab[] {
  if (module === "study") {
    // The planner is the one Study surface gated on an academic affiliation;
    // Study Essentials is open to everyone preparing to arrive.
    return STUDY_TABS.filter((tab) => tab.key !== "tools" || showAcademicTools);
  }
  if (module === "guide") return [...GUIDE_TABS];
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
  // Orders belong to Study Essentials, so the tab stays lit while a student
  // reads a receipt.
  if (
    pathname.startsWith("/student-hub/essentials") ||
    pathname.startsWith("/student-hub/orders")
  ) {
    return "essentials";
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
  const activeModuleIndex = STUDENT_HUB_MODULES.findIndex(
    (module) => module.key === activeModule,
  );
  const activeTabIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.key === activeKey),
  );
  // A module-level offset preserves transition direction even when both
  // modules open on their first contextual destination.
  const transitionIndex = Math.max(0, activeModuleIndex) * 10 + activeTabIndex;
  const secondaryNavigationLabel =
    activeModule === "study"
      ? "Study navigation"
      : activeModule === "guide"
        ? "Guide navigation"
        : "Opportunity navigation";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PresenceHeartbeat />
      <ProductAnalyticsIdentity user={user} />
      <a
        className="sr-only z-[60] rounded-full bg-background px-4 py-2 font-bold text-foreground shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        href="#student-hub-content"
      >
        Skip to Student Hub content
      </a>

      {/*
        Entering the hub is a change of place, not another menu click. The way
        out comes first, the academic identity has room to breathe, and the
        module navigation sits below it instead of being crushed against the
        Kondo mark.
      */}
      <header className="relative overflow-hidden border-b border-border/60">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-kondo-mint/70 via-background to-background dark:from-emerald-400/10 dark:via-background dark:to-background"
        />
        <div aria-hidden="true" className="noise absolute inset-0 opacity-70" />
        <div className="relative mx-auto max-w-[1440px] px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-5">
          {/* The Kondo mark belongs to the global shell. Inside the hub the
              label names the space the student just entered. */}
          <div className="flex items-center gap-3">
            <BackButton fallbackHref="/home" label="Leave Student Hub" />
            <span className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-kondo-green text-white shadow-soft"
              >
                <GraduationCap className="h-[18px] w-[18px]" />
              </span>
              <span className="text-base font-black tracking-tight text-kondo-ink dark:text-white">
                Student Hub
              </span>
            </span>
          </div>

          {/* Deliberately not an <h1>: this banner is shared chrome, and each
              page inside the hub owns the document heading that describes it. */}
          <p className="mt-7 max-w-3xl text-balance font-display text-3xl font-black leading-[1.08] tracking-[-0.04em] sm:mt-9 sm:text-4xl">
            {user.university?.name
              ? `Your academic space at ${user.university.name}.`
              : "Your academic space."}
          </p>
          <p className="mt-2.5 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
            Everything for your studies in one place — your timetable and
            deadlines, the guidance that helps you settle, and the
            opportunities open to you.
          </p>

          <HorizontalTabs
            activeKey={activeModule}
            ariaLabel="Student Hub modules"
            className="mt-8 max-w-[720px] sm:mt-10"
            fill
            tabs={STUDENT_HUB_MODULES}
          />
        </div>
      </header>

      {tabs.length ? (
        <div className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            <HorizontalTabs
              activeKey={activeKey}
              ariaLabel={secondaryNavigationLabel}
              className="py-1.5"
              tabs={tabs}
            />
          </div>
        </div>
      ) : null}
      <main id="student-hub-content">
        <TabPanelTransition index={transitionIndex}>
          {children}
        </TabPanelTransition>
      </main>
      <KondoPet enabled={kondoPetEnabled} />
    </div>
  );
}
