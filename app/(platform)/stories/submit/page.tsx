import type { Metadata } from "next";
import { StorySubmissionWorkspace } from "@/components/features/stories/StorySubmissionWorkspace";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  getOwnStorySubmissionForEditing,
  getStoryPublishingOptions,
  listOwnStorySubmissions,
} from "@/lib/stories";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Submit a Student Story" };

export default async function StorySubmitPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const storyId = Array.isArray(params.story) ? params.story[0] : params.story;
  const [options, submissions, editing] = await Promise.all([
    getStoryPublishingOptions(user),
    listOwnStorySubmissions(user),
    getOwnStorySubmissionForEditing(user, storyId),
  ]);
  return (
    <main className="mx-auto max-w-[1320px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Share one practical experience that helps another African student find their way in China."
        eyebrow="Student Stories"
        title={editing ? "Revise your Story" : "Submit a useful Story"}
      />
      <StorySubmissionWorkspace
        editing={editing}
        options={options}
        submissions={submissions}
      />
    </main>
  );
}
