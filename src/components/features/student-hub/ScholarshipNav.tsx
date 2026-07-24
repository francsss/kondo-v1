import Link from "next/link";
import { BriefcaseBusiness, GraduationCap } from "lucide-react";

export function ScholarshipNav({
  active,
}: {
  active: "opportunities" | "agents";
}) {
  return (
    <nav
      aria-label="Scholarship ecosystem"
      className="mt-6 flex gap-2 overflow-x-auto"
    >
      <Link
        aria-current={active === "opportunities" ? "page" : undefined}
        className={
          active === "opportunities"
            ? "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full bg-kondo-ink px-4 text-sm font-black text-white dark:bg-emerald-400 dark:text-kondo-ink"
            : "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-card px-4 text-sm font-black"
        }
        href="/student-hub/scholarships"
      >
        <GraduationCap className="h-4 w-4" />
        Opportunities
      </Link>
      <Link
        aria-current={active === "agents" ? "page" : undefined}
        className={
          active === "agents"
            ? "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full bg-kondo-ink px-4 text-sm font-black text-white dark:bg-emerald-400 dark:text-kondo-ink"
            : "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-card px-4 text-sm font-black"
        }
        href="/student-hub/scholarships/agents"
      >
        <BriefcaseBusiness className="h-4 w-4" />
        Scholarship agents
      </Link>
    </nav>
  );
}
