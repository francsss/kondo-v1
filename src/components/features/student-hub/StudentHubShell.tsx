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

const TOOLS_TAB: HorizontalTab = {
  key: "tools",
  href: "/student-hub/tools",
  label: "Tools",
};

/**
 * Student Hub navigation.
 *
 * The generic "Opportunities" entry was removed: it opened the same central
 * domain every other entry already projects, so the hub presented two competing
 * navigations for one feature. Each remaining entry is a category a student
 * actually searches for.
 */
function studentHubTabs(showAcademicTools: boolean): HorizontalTab[] {
  const tabs: HorizontalTab[] = STUDENT_HUB_SECTIONS.map((section) => ({
    key: section.key,
    href: section.href,
    label: section.label,
  }));
  return showAcademicTools ? [...tabs, TOOLS_TAB] : tabs;
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
  const access = studentHubAccessForJourney(user.studentJourney);
  const tabs = studentHubTabs(access.academicTools);
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
            activeKey={activeKey}
            ariaLabel="Student Hub"
            tabs={tabs}
          />
        </div>
      </header>
      <main>
        <TabPanelTransition index={activeIndex}>{children}</TabPanelTransition>
      </main>
      <KondoPet enabled={kondoPetEnabled} />
    </div>
  );
}
