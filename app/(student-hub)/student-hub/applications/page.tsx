import type { Metadata } from "next";
import { ApplicantApplicationList } from "@/components/features/opportunities/ApplicantApplicationList";
import { OpportunityAccountNav } from "@/components/features/opportunities/OpportunityAccountNav";
import { StudentHubSectionHeader } from "@/components/features/student-hub/StudentHubSectionHeader";
import { listApplicationsForApplicant } from "@/lib/opportunity-applications";
import { requireUser } from "@/lib/server-auth";
import { studentHubSection } from "@/lib/student-hub-sections";

const section = studentHubSection("applications");

export const metadata: Metadata = {
  title: section.title,
  robots: { index: false },
};
// Private to one applicant: never cached.
export const dynamic = "force-dynamic";

export default async function StudentHubApplicationsPage() {
  const user = await requireUser();
  const applications = await listApplicationsForApplicant(user.id);

  return (
    <div className="mx-auto max-w-[900px] px-4 pb-20 pt-8 sm:px-6 lg:pt-12">
      <StudentHubSectionHeader sectionKey="applications">
        <p className="mt-2 text-sm text-muted-foreground">
          Kondo records the status a publisher set. It does not predict a
          decision or a response time.
        </p>
      </StudentHubSectionHeader>
      <OpportunityAccountNav />
      <ApplicantApplicationList
        applications={applications}
        browseHref="/student-hub/scholarships"
        browseLabel="Browse scholarships"
        emptyBody={section.emptyBody}
        emptyTitle={section.emptyTitle}
      />
    </div>
  );
}
