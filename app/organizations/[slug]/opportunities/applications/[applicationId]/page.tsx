import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OpportunityReviewerActions } from "@/components/features/opportunities/OpportunityReviewerActions";
import { getOrganizationApplication } from "@/lib/opportunity-application-review";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Application review",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ApplicationReviewPage({
  params,
}: {
  params: Promise<{ slug: string; applicationId: string }>;
}) {
  const { slug, applicationId } = await params;
  const user = await requireUser();
  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, publicName: true },
  });
  if (!organization) notFound();

  const application = await getOrganizationApplication({
    userId: user.id,
    organizationId: organization.id,
    applicationId,
  });

  return (
    <div className="mx-auto max-w-[800px] px-4 pb-20 pt-8 sm:px-6 lg:pt-12">
      <h1 className="text-2xl font-black tracking-[-0.03em]">
        {application.applicant.name ?? "Applicant"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {application.opportunity.title} · {application.statusLabel}
      </p>

      <section aria-labelledby="submitted-heading" className="mt-8">
        <h2 id="submitted-heading" className="text-lg font-black">
          Submitted information
        </h2>
        {/* Exactly what the applicant submitted — the immutable snapshot, not
            their current profile. */}
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold">University</dt>
            <dd className="text-muted-foreground">
              {application.applicant.university ?? "Not provided"}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Field of study</dt>
            <dd className="text-muted-foreground">
              {application.applicant.degree ?? "Not provided"}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Degree level</dt>
            <dd className="text-muted-foreground">
              {application.applicant.studyLevel ?? "Not provided"}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Location</dt>
            <dd className="text-muted-foreground">
              {[application.applicant.city, application.applicant.country]
                .filter(Boolean)
                .join(", ") || "Not provided"}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="answers-heading" className="mt-8">
        <h2 id="answers-heading" className="text-lg font-black">
          Answers
        </h2>
        <dl className="mt-3 space-y-3 text-sm">
          {application.answers.map((answer) => (
            <div key={answer.questionId}>
              <dt className="font-semibold">{answer.label}</dt>
              <dd className="text-muted-foreground">
                {answer.answerText ?? "No answer"}
              </dd>
            </div>
          ))}
          {application.answers.length === 0 ? (
            <p className="text-muted-foreground">No questions were asked.</p>
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="documents-heading" className="mt-8">
        <h2 id="documents-heading" className="text-lg font-black">
          Documents
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          {application.documents.map((document) => (
            <li key={document.id}>
              {/* Delivery re-checks membership and attachment; no storage key
                  is present in this page. */}
              <a href={document.href} className="font-semibold underline">
                {document.displayName}
              </a>
            </li>
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
        <ol className="mt-3 space-y-3 text-sm">
          {application.timeline.map((entry) => (
            <li key={entry.id}>
              <p className="font-semibold">{entry.label}</p>
              {entry.applicantVisibleNote ? (
                <p className="text-muted-foreground">
                  Shared with applicant: {entry.applicantVisibleNote}
                </p>
              ) : null}
              {entry.internalNote ? (
                // Visually and structurally distinct from applicant-visible
                // notes, and never sent in notifications or emails.
                <p className="mt-1 rounded-xl bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
                  Internal note (not shared): {entry.internalNote}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <OpportunityReviewerActions
        organizationId={organization.id}
        applicationId={application.id}
      />
    </div>
  );
}
