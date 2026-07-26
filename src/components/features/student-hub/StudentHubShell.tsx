"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { ProductAnalyticsIdentity } from "@/components/analytics/ProductAnalytics";
import { PresenceHeartbeat } from "@/components/app/PresenceHeartbeat";
import { KondoPet } from "@/components/features/feedback/KondoPet";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/student-hub", label: "Guides" },
  { href: "/student-hub/scholarships", label: "Scholarships" },
  { href: "/student-hub/internships", label: "Internships" },
  { href: "/student-hub/opportunities", label: "Opportunities" },
  { href: "/student-hub/tools", label: "Tools" },
] as const;

const kondoPetEnabled = process.env.NEXT_PUBLIC_KONDO_PET_ENABLED !== "false";

function isActiveTab(pathname: string, href: (typeof tabs)[number]["href"]) {
  return href === "/student-hub"
    ? pathname === href || pathname.startsWith("/student-hub/guide/")
    : pathname.startsWith(href);
}

function StudentHubTabs({
  pathname,
  mobile = false,
}: {
  pathname: string;
  mobile?: boolean;
}) {
  return (
    <nav
      aria-label={mobile ? "Student Hub mobile" : "Student Hub"}
      className={cn(
        mobile
          ? "grid grid-cols-6 border-t border-border/70 pt-2"
          : "hidden items-center border-b border-border md:flex",
      )}
    >
      {tabs.map(({ href, label }, index) => {
        const active = isActiveTab(pathname, href);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative isolate inline-flex items-center justify-center whitespace-nowrap font-bold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              mobile
                ? cn(
                    "min-h-9 px-1 text-[11px]",
                    index < 3 ? "col-span-2" : "col-span-3",
                  )
                : "h-11 px-4 text-sm",
              active
                ? "text-kondo-green"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
            data-product-event={PRODUCT_EVENTS.STUDENT_HUB_TOOL_SELECTED}
            data-product-source={label.toLowerCase().replaceAll(" ", "_")}
            href={href}
            key={href}
          >
            {active ? (
              <motion.span
                className="absolute inset-x-3 bottom-0 -z-10 h-0.5 rounded-full bg-kondo-green shadow-[0_0_12px_rgba(52,211,153,0.35)]"
                layoutId={
                  mobile ? "student-hub-mobile-tab" : "student-hub-desktop-tab"
                }
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            ) : null}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

type StudentHubUser = {
  id: string;
  role: string;
  country?: { code: string; name: string } | null;
  city?: { slug: string; name: string } | null;
  university?: { slug: string; name: string } | null;
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
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PresenceHeartbeat />
      <ProductAnalyticsIdentity user={user} />
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 shadow-[0_8px_28px_rgb(var(--foreground)/0.04)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto grid h-16 max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            aria-label="Back to Kondo"
            className="group inline-flex w-fit items-center gap-2 rounded-full px-2 py-2 text-sm font-bold text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/home"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline">Back to Kondo</span>
            <span className="sm:hidden">Kondo</span>
          </Link>
          <StudentHubTabs pathname={pathname} />
        </div>
        <div className="px-4 pb-2 md:hidden">
          <StudentHubTabs mobile pathname={pathname} />
        </div>
      </header>
      <main>{children}</main>
      <KondoPet enabled={kondoPetEnabled} />
    </div>
  );
}
