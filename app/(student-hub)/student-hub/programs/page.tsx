import type { Metadata } from "next";
import { StudentHubOpportunitySection } from "@/components/features/student-hub/StudentHubOpportunitySection";
import { StudentHubSectionHeader } from "@/components/features/student-hub/StudentHubSectionHeader";
import { requireUser } from "@/lib/server-auth";
import { studentHubSection } from "@/lib/student-hub-sections";

const section = studentHubSection("programs");

export const metadata: Metadata = {
  title: section.title,
  description: section.description,
};

/**
 * Research placements, exchanges, summer programmes, competitions and
 * volunteering. This section spans three opportunity categories, which is why
 * the Student Hub keeps its own section registry rather than reusing them.
 */
export default async function StudentHubProgramsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      <StudentHubSectionHeader sectionKey="programs" />
      <StudentHubOpportunitySection
        params={params}
        sectionKey="programs"
        viewerUserId={user.id}
      />
    </div>
  );
}
