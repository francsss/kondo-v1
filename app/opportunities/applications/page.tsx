import type { Metadata } from "next";
import Link from "next/link";
import { OpportunityAccountNav } from "@/components/features/opportunities/OpportunityAccountNav";
import { listApplicationsForApplicant } from "@/lib/opportunity-applications";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "My applications",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

const SECTIONS = [
  { key: "drafts", label: "Drafts" },
  { key: "action-required", label: "Action required" },
  { key: "in-review", label: "In review" },
  { key: "interviews", label: "Interviews" },
  { key: "offers", label: "Offers" },
  { key: "completed", label: "Completed" },
] as const;

export default async function ApplicationsPage() {
  const user = await requireUser();
  const applications = await listApplicationsForApplicant(user.id);

  return (
    <div className="mx-auto max-w-[900px] px-4 pb-20 pt-8 sm:px-6 lg:pt-12">
      <h1 className="text-3xl font-black tracking-[-0.04em]">
        My applications
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Kondo records the status a provider set here. It does not predict a
        decision or a response time.
      </p>
      <OpportunityAccountNav />

      {applications.length === 0 ? (
        <p className="mt-10 rounded-3xl border border-dashed border-black/10 p-8 text-center text-sm text-muted-foreground dark:border-white/15">
          No applications yet.{" "}
          <Link href="/opportunities" className="font-bold underline">
            Find an opportunity
          </Link>
        </p>
      ) : (
        SECTIONS.map((section) => {
          const items = applications.filter(
            (application) => application.bucket === section.key,
          );
          if (items.length === 0) return null;
          return (
            <section key={section.key} className="mt-8">
              <h2 className="text-lg font-black tracking-[-0.02em]">
                {section.label}
              </h2>
              <ul className="mt-3 space-y-3">
                {items.map((application) => (
                  <li
                    key={application.id}
                    className="rounded-3xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-white/5"
                  >
                    <p className="font-bold">
                      <Link
                        href={`/opportunities/applications/${application.id}`}
                        className="hover:underline"
                      >
                        {application.opportunity.title}
                      </Link>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {application.opportunity.organizationName} ·{" "}
                      {application.statusLabel}
                      {application.submittedAt
                        ? ` · submitted ${new Date(application.submittedAt).toLocaleDateString("en-GB")}`
                        : ""}
                    </p>
                    {!application.opportunity.available ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        This opportunity is no longer published. Your
                        application history is kept.
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
