"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProductAnalyticsIdentity } from "@/components/analytics/ProductAnalytics";
import { PresenceHeartbeat } from "@/components/app/PresenceHeartbeat";
import { KondoPet } from "@/components/features/feedback/KondoPet";
import {
  HorizontalTabs,
  TabPanelTransition,
  type HorizontalTab,
} from "@/components/ui/HorizontalTabs";
import { studentHubAccessForJourney } from "@/lib/personal-journeys";
import { STUDENT_HUB_SECTIONS } from "@/lib/student-hub-sections";

const kondoPetEnabled = process.env.NEXT_PUBLIC_KONDO_PET_ENABLED !== "false";

const STUDENT_HUB_MODULES: readonly HorizontalTab[] = [
  {
    key: "study",
    href: "/student-hub",
    label: "Study",
  },
  {
    key: "opportunities",
    href: "/student-hub/scholarships",
    label: "Opportunities",
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
export function studentHubModuleForPath(pathname: string) {
  return STUDENT_HUB_SECTIONS.some(
    (section) =>
      section.key !== "overview" &&
      (pathname === section.href || pathname.startsWith(`${section.href}/`)),
  )
    ? "opportunities"
    : "study";
}

export function studentHubTabsForModule(
  module: "study" | "opportunities",
  showAcademicTools: boolean,
): HorizontalTab[] {
  if (module === "study") {
    return STUDY_TABS.filter((tab) => tab.key !== "tools" || showAcademicTools);
  }
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
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 shadow-[0_8px_28px_rgb(var(--foreground)/0.04)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto grid max-w-[1440px] grid-cols-[auto_minmax(0,1fr)] items-center gap-4 px-4 py-2.5 sm:px-6 lg:gap-8 lg:px-8">
          <Link
            aria-label="Back to Kondo"
            className="group inline-flex w-fit items-center gap-2 rounded-full px-2 py-2 text-sm font-bold text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/home"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline">Back to Kondo</span>
            <span className="sm:hidden">Kondo</span>
          </Link>
          <HorizontalTabs
            activeKey={activeModule}
            ariaLabel="Student Hub modules"
            className="sm:justify-center"
            tabs={STUDENT_HUB_MODULES}
          />
        </div>
        <div className="border-t border-border/70 bg-muted/20">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            <HorizontalTabs
              activeKey={activeKey}
              ariaLabel={`${activeModule === "study" ? "Study" : "Opportunity"} navigation`}
              className="py-1 sm:justify-center"
              tabs={tabs}
            />
          </div>
        </div>
      </header>
      <main>
        <TabPanelTransition index={activeIndex}>{children}</TabPanelTransition>
      </main>
      <KondoPet enabled={kondoPetEnabled} />
    </div>
  );
}
