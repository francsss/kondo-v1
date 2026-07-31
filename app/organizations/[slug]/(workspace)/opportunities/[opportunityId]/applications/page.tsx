import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listOrganizationApplications } from "@/lib/opportunity-application-review";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Applications",
  robots: { index: false, follow: false },
};
// Applicant data is never cached: always rendered for one authorized reviewer.
export const dynamic = "force-dynamic";

export default async function OrganizationApplicationsPage({
  params,
}: {
  params: Promise<{ slug: string; opportunityId: string }>;
}) {
  const { slug, opportunityId } = await params;
  const user = await requireUser();
  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, slug: true, publicName: true },
  });
  if (!organization) notFound();

  // Throws 403 for a member without ORGANIZATION_VIEW_APPLICATIONS, which is
  // exactly what an EDITOR hits.
  const applications = await listOrganizationApplications({
    userId: user.id,
    organizationId: organization.id,
    opportunityId,
  });

  return (
    <section>
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link
          href={`/organizations/${organization.slug}/opportunities`}
          className="hover:underline"
        >
          Opportunities
        </Link>
      </nav>
      <h1 className="mt-2 text-2xl font-black tracking-[-0.03em]">
        Applications
      </h1>

      {applications.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-border p-10 text-center">
          <h2 className="text-lg font-black">No applications yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Applications appear here once this opportunity accepts Kondo
            applications and receives its first submission.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {applications.map((application) => (
            <li
              key={application.id}
              className="rounded-3xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-white/5"
            >
              <p className="font-bold">
                <Link
                  href={`/organizations/${organization.slug}/opportunities/applications/${application.id}`}
                  className="hover:underline"
                >
                  {application.applicantName ?? "Applicant"}
                </Link>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {application.statusLabel}
                {application.university ? ` · ${application.university}` : ""}
                {application.fieldOfStudy
                  ? ` · ${application.fieldOfStudy}`
                  : ""}
                {` · ${application.documentCount} document(s)`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
