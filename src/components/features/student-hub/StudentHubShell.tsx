"use client";

import { usePathname } from "next/navigation";
import { Compass, GraduationCap, Library, Rocket } from "lucide-react";
import { ProductAnalyticsIdentity } from "@/components/analytics/ProductAnalytics";
import { PresenceHeartbeat } from "@/components/app/PresenceHeartbeat";
import { KondoPet } from "@/components/features/feedback/KondoPet";
import { StudentHubMobileNav } from "@/components/features/student-hub/StudentHubMobileNav";
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
 * The four pillars of the hub. Each answers one student sentence: Study is
 * "I manage my academic life", Study Essentials is "my academic resources",
 * Guide is "help me navigate my journey", Opportunities is "I build my
 * future".
 *
 * Study Essentials is a pillar in its own right rather than a Study tab: a
 * library, a reader and personal notes are a place a student goes to, not a
 * sub-page of coursework management.
 */
export const STUDENT_HUB_PILLARS = [
  {
    key: "study",
    href: "/student-hub",
    label: "Study",
    shortLabel: "Study",
    emoji: "📚",
    Icon: GraduationCap,
  },
  {
    key: "essentials",
    href: "/student-hub/essentials",
    label: "Study Essentials",
    shortLabel: "Essentials",
    emoji: "📗",
    Icon: Library,
  },
  {
    key: "guide",
    href: "/student-hub/resources",
    label: "Guide",
    shortLabel: "Guide",
    emoji: "📖",
    Icon: Compass,
  },
  {
    key: "opportunities",
    href: "/student-hub/scholarships",
    label: "Opportunities",
    shortLabel: "Future",
    emoji: "🚀",
    Icon: Rocket,
  },
] as const;

const STUDENT_HUB_MODULES: readonly HorizontalTab[] = STUDENT_HUB_PILLARS.map(
  ({ key, href, label, emoji }) => ({ key, href, label, icon: emoji }),
);

/**
 * Study asks three questions and nothing else.
 *
 * Overview: what is happening? Planner: what do I need to organise?
 * Workspace: what do I study right now?
 *
 * Academic tools moved under Planner, which is where a student already goes to
 * organise; Student Q&A moved to Guide, because asking how residence permits
 * work is student life, not coursework. Both keep their routes.
 */
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
    key: "workspace",
    href: "/student-hub/workspace",
    label: "Workspace",
  },
];

/**
 * Study Essentials owns acquiring, reading and annotating. Digital Books and
 * Purchased Materials are the two shelves of the same library rather than
 * separate stores, so they share its data and differ only by what they show.
 */
const ESSENTIALS_TABS: readonly HorizontalTab[] = [
  {
    key: "library",
    href: "/student-hub/essentials/library",
    label: "My Library",
  },
  {
    key: "books",
    href: "/student-hub/essentials/books",
    label: "Digital Books",
  },
  {
    key: "materials",
    href: "/student-hub/essentials/materials",
    label: "Purchased Materials",
  },
  {
    key: "notes",
    href: "/student-hub/essentials/notes",
    label: "Notes",
  },
  {
    key: "resources",
    href: "/student-hub/essentials",
    label: "Study Resources",
  },
];

/**
 * Guide is where a student goes for help with the journey rather than with a
 * course. The routes themselves are unchanged.
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
export type StudentHubModule =
  "study" | "essentials" | "guide" | "opportunities";

export function studentHubModuleForPath(pathname: string): StudentHubModule {
  // Orders are receipts for acquired resources, so they belong to Essentials.
  if (
    pathname === "/student-hub/essentials" ||
    pathname.startsWith("/student-hub/essentials/") ||
    pathname === "/student-hub/orders" ||
    pathname.startsWith("/student-hub/orders/")
  ) {
    return "essentials";
  }
  if (
    pathname === "/student-hub/resources" ||
    pathname.startsWith("/student-hub/resources/") ||
    // Student Q&A is help with student life, so it sits under Guide.
    pathname === "/student-hub/help" ||
    pathname.startsWith("/student-hub/help/") ||
    // A guide reader is Guide content; Study stopped listing guides.
    pathname.startsWith("/student-hub/guide/")
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
    // Planner and Workspace both read a real timetable, so they stay gated on
    // an academic affiliation. Overview is not.
    return STUDY_TABS.filter(
      (tab) =>
        showAcademicTools || (tab.key !== "tools" && tab.key !== "workspace"),
    );
  }
  if (module === "essentials") return [...ESSENTIALS_TABS];
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
  if (pathname === "/student-hub") return "overview";
  // A guide opened from Guide keeps Guide's Overview lit, not Study's.
  if (pathname.startsWith("/student-hub/guide/")) return "resource-home";
  // The reader and a receipt both belong to the shelf the resource sits on,
  // so My Library stays lit while a student reads or checks an order.
  if (
    pathname.startsWith("/student-hub/essentials/read/") ||
    pathname.startsWith("/student-hub/orders")
  ) {
    return "library";
  }
  // A product page and its checkout belong to the catalogue they came from.
  if (
    pathname === "/student-hub/essentials" ||
    /^\/student-hub\/essentials\/[^/]+(\/checkout)?$/.test(pathname)
  ) {
    const owned = new Set(["library", "books", "materials", "notes"]);
    const dedicated = tabs.find(
      (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`),
    );
    if (!dedicated || !owned.has(dedicated.key)) return "resources";
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
      : activeModule === "essentials"
        ? "Study Essentials navigation"
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
      {/* `data-focus-hide` is how Focus Mode disappears this chrome: a class
          on <html> hides every marked element, so entering focus is a style
          change on the same route with the same component tree — no
          navigation, no refetch, no lost reading position. */}
      <header
        className="relative overflow-hidden border-b border-border/60"
        data-focus-hide=""
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-kondo-mint/70 via-background to-background dark:from-emerald-400/10 dark:via-background dark:to-background"
        />
        <div aria-hidden="true" className="noise absolute inset-0 opacity-70" />
        <div className="relative mx-auto max-w-[1440px] px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-5">
          {/* The Kondo mark belongs to the global shell. Inside the hub the
              label names the space the student just entered. */}
          <div className="flex items-center gap-3">
            <BackButton
              exitPrefix="/student-hub"
              fallbackHref="/home"
              label="Leave Student Hub"
            />
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
          {/* Deliberately smaller on a phone. This banner is shared chrome
              repeated on every hub screen, and at display size it pushed the
              first class of the day below the fold. Desktop keeps the full
              statement, where there is room for both. */}
          <p className="mt-4 max-w-3xl text-balance font-display text-xl font-black leading-[1.12] tracking-[-0.04em] sm:mt-9 sm:text-4xl sm:leading-[1.08]">
            {user.university?.name
              ? `Your academic space at ${user.university.name}.`
              : "Your academic space."}
          </p>
          <p className="mt-2.5 hidden max-w-2xl text-pretty text-sm leading-6 text-muted-foreground sm:block sm:text-base sm:leading-7">
            Everything for your studies in one place — your timetable and
            deadlines, the guidance that helps you settle, and the opportunities
            open to you.
          </p>

          {/* Desktop keeps the premium horizontal pillars; a phone gets the
              dedicated bottom bar instead, so the two never compete. */}
          <HorizontalTabs
            activeKey={activeModule}
            ariaLabel="Student Hub modules"
            className="mt-8 hidden max-w-[860px] lg:mt-10 lg:flex"
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
      {/* The hub's own bottom bar clears the last rows of content on a phone. */}
      <main className="pb-24 lg:pb-0" id="student-hub-content">
        <TabPanelTransition index={transitionIndex}>
          {children}
        </TabPanelTransition>
      </main>
      <div data-focus-hide="">
        <StudentHubMobileNav activeModule={activeModule} />
      </div>
      <KondoPet enabled={kondoPetEnabled} />
    </div>
  );
}
