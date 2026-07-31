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
    <div className="mx-auto max-w-[1100px] px-4 pb-20 pt-8 sm:px-6 lg:pt-12">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link
          href={`/organizations/${organization.slug}/opportunities`}
          className="hover:underline"
        >
          Opportunities
        </Link>
      </nav>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">
        Applications
      </h1>

      {applications.length === 0 ? (
        <p className="mt-10 rounded-3xl border border-dashed border-black/10 p-8 text-center text-sm text-muted-foreground dark:border-white/15">
          No submitted applications yet.
        </p>
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
    </div>
  );
}
