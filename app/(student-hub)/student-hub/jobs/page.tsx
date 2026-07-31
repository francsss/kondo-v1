import type { Metadata } from "next";
import { StudentHubOpportunitySection } from "@/components/features/student-hub/StudentHubOpportunitySection";
import { StudentHubSectionHeader } from "@/components/features/student-hub/StudentHubSectionHeader";
import { requireUser } from "@/lib/server-auth";
import { studentHubSection } from "@/lib/student-hub-sections";

const section = studentHubSection("jobs");

export const metadata: Metadata = {
  title: section.title,
  description: section.description,
};

/** PART_TIME_JOB, FULL_TIME_JOB and CAMPUS_JOB from the central domain. */
export default async function StudentHubJobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      <StudentHubSectionHeader sectionKey="jobs" />
      <StudentHubOpportunitySection
        params={params}
        sectionKey="jobs"
        viewerUserId={user.id}
      />
    </div>
  );
}
