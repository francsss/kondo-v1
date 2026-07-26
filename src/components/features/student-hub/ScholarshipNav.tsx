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
      className="mt-6 grid max-w-xl grid-cols-2 border-b border-border"
    >
      <Link
        aria-current={active === "opportunities" ? "page" : undefined}
        className={
          active === "opportunities"
            ? "relative inline-flex min-h-12 items-center justify-center gap-2 px-3 text-sm font-black text-kondo-green after:absolute after:inset-x-5 after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-kondo-green"
            : "inline-flex min-h-12 items-center justify-center gap-2 px-3 text-sm font-bold text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
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
            ? "relative inline-flex min-h-12 items-center justify-center gap-2 px-3 text-sm font-black text-kondo-green after:absolute after:inset-x-5 after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-kondo-green"
            : "inline-flex min-h-12 items-center justify-center gap-2 px-3 text-sm font-bold text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
        }
        href="/student-hub/scholarships/agents"
      >
        <BriefcaseBusiness className="h-4 w-4" />
        Scholarship agents
      </Link>
    </nav>
  );
}
