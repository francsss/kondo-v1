import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OpportunityApplicationActions } from "@/components/features/opportunities/OpportunityApplicationActions";
import { getApplicationForApplicant } from "@/lib/opportunity-applications";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Application",
  // Applications are always private and excluded from indexing and the sitemap.
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const user = await requireUser();
  const application = await getApplicationForApplicant({
    userId: user.id,
    applicationId: (await params).applicationId,
  });
  if (!application) notFound();

  return (
    <div className="mx-auto max-w-[760px] px-4 pb-20 pt-8 sm:px-6 lg:pt-12">
      <h1 className="text-2xl font-black tracking-[-0.03em]">
        {application.opportunity.title}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {application.opportunity.organizationName} · {application.statusLabel}
      </p>

      <section aria-labelledby="submitted-heading" className="mt-8">
        <h2 id="submitted-heading" className="text-lg font-black">
          What you submitted
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          {application.documents.map((document) => (
            <li key={document.id}>{document.displayName}</li>
          ))}
          {application.documents.length === 0 ? (
            <li className="text-muted-foreground">No documents attached.</li>
          ) : null}
        </ul>
      </section>

      <section aria-labelledby="history-heading" className="mt-8">
        <h2 id="history-heading" className="text-lg font-black">
          Status history
        </h2>
        <ol className="mt-3 space-y-3">
          {application.timeline.map((entry) => (
            <li key={entry.id} className="text-sm">
              <p className="font-semibold">{entry.label}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(entry.at).toLocaleString("en-GB")}
              </p>
              {/* Only applicant-visible notes exist in this DTO; internal
                  reviewer notes are never selected for applicants. */}
              {entry.note ? <p className="mt-1">{entry.note}</p> : null}
            </li>
          ))}
        </ol>
      </section>

      <OpportunityApplicationActions
        applicationId={application.id}
        status={application.status}
        opportunityHref={application.opportunity.href}
        interviews={application.interviews}
      />

      <p className="mt-8 text-xs text-muted-foreground">
        A recorded offer means the provider registered it in Kondo. It is not a
        contract and does not guarantee a place, funding or employment.
      </p>
    </div>
  );
}
