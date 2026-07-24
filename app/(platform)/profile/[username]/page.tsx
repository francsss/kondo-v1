import { notFound } from "next/navigation";
import { ProfileView } from "@/components/features/profile/ProfileView";
import { getPublicProfile, ProfileError } from "@/lib/profiles";
import { requireUser } from "@/lib/server-auth";
import { getContextualStories } from "@/lib/stories";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const currentUser = await requireUser();
  let profile;
  try {
    profile = await getPublicProfile((await params).username, currentUser);
  } catch (error) {
    if (error instanceof ProfileError && error.status === 404) notFound();
    throw error;
  }
  const stories = await getContextualStories(currentUser, {
    creatorId: profile.id,
    limit: 6,
  });
  return (
    <ProfileView
      currentUserId={currentUser.id}
      profile={profile}
      stories={stories}
    />
  );
}
