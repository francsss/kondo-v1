import Link from "next/link";
import { Sparkles } from "lucide-react";
import { STUDY_ESSENTIAL_SECTIONS } from "@/lib/study-workspace";
import { cn } from "@/lib/utils";

/**
 * In-page navigation for the Study Essentials workspace.
 *
 * Deliberately not a third sticky tab bar: the hub already has pillars and a
 * Study row, and stacking a third band of tabs is exactly the nesting that
 * makes a product read as a pile of menus. This sits inside the page, as part
 * of its content.
 */
export function StudyEssentialsNav({
  active,
}: {
  active: "browse" | "library" | "notes";
}) {
  return (
    <nav
      aria-label="Study Essentials sections"
      className="flex flex-wrap items-center gap-1.5"
    >
      {STUDY_ESSENTIAL_SECTIONS.map((section) => {
        const current = section.key === active;
        return (
          <Link
            aria-current={current ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center rounded-full px-4 text-sm font-black transition",
              current
                ? "bg-kondo-forest text-white shadow-sm dark:bg-emerald-400/15 dark:text-emerald-100"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            href={section.href}
            key={section.key}
          >
            {section.label}
          </Link>
        );
      })}
      <span
        className="inline-flex min-h-10 cursor-not-allowed items-center gap-1.5 rounded-full border border-dashed border-border px-4 text-sm font-bold text-muted-foreground/70"
        title="The study assistant is not available yet."
      >
        <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
        AI Study Assistant
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em]">
          Soon
        </span>
      </span>
    </nav>
  );
}
