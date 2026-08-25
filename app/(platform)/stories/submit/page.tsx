import type { Metadata } from "next";
import { StorySubmissionWorkspace } from "@/components/features/stories/StorySubmissionWorkspace";
import {
  getOwnStorySubmissionForEditing,
  getStoryPublishingOptions,
  listOwnStorySubmissions,
} from "@/lib/stories";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Create Reel" };

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
  /*
   * No page header here: the workspace draws its own compact one inside the
   * focused shell, which is also what stands the app chrome down. A second
   * title above it would put the two most prominent things on the screen in
   * competition and cost a phone most of its first fold.
   */
  return (
    <main>
      <StorySubmissionWorkspace
        editing={editing}
        options={options}
        submissions={submissions}
      />
    </main>
  );
}
