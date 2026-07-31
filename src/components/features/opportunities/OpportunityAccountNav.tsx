import Link from "next/link";

/**
 * The signed-in student's own opportunity workspace: applications, saved
 * records, reusable documents, applicant profile and preferences.
 *
 * These routes were previously reachable only from each other, so the whole
 * cluster was a closed loop with no way in. It is now rendered from the Student
 * Hub Applications section as well, which is the entry point students actually
 * navigate to.
 */
const LINKS = [
  ["/student-hub/applications", "Applications"],
  ["/opportunities/saved", "Saved"],
  ["/opportunities/documents", "Documents"],
  ["/opportunities/profile", "Profile"],
  ["/opportunities/preferences", "Preferences"],
  ["/opportunities", "Browse all"],
] as const;

export function OpportunityAccountNav() {
  return (
    <nav aria-label="Your Opportunities" className="mt-5 overflow-x-auto pb-1">
      <ul className="flex min-w-max gap-2">
        {LINKS.map(([href, label]) => (
          <li key={href}>
            <Link
              href={href}
              className="inline-flex min-h-9 items-center rounded-full border border-black/10 px-3.5 py-2 text-xs font-bold transition hover:border-kondo-green/40 hover:bg-kondo-green/5 dark:border-white/10"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
