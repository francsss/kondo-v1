import Link from "next/link";

const LINKS = [
  ["/opportunities/applications", "Applications"],
  ["/opportunities/saved", "Saved"],
  ["/opportunities/documents", "Documents"],
  ["/opportunities/profile", "Profile"],
  ["/opportunities/preferences", "Preferences"],
] as const;

export function OpportunityAccountNav() {
  return (
    <nav aria-label="Your Opportunities" className="mt-5 overflow-x-auto pb-1">
      <ul className="flex min-w-max gap-2">
        {LINKS.map(([href, label]) => (
          <li key={href}>
            <Link
              href={href}
              className="inline-flex rounded-full border border-black/10 px-3.5 py-2 text-xs font-bold transition hover:border-kondo-green/40 hover:bg-kondo-green/5 dark:border-white/10"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
