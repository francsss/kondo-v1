import type { Metadata } from "next";
import { ProfileView } from "@/components/features/profile/ProfileView";
import { getPublicProfile, getSavedContent } from "@/lib/profiles";
import { requireUser } from "@/lib/server-auth";
import { getContextualStories } from "@/lib/stories";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab =
    rawTab === "saved" || rawTab === "marketplace" ? rawTab : "activity";
  const [profile, saved, stories] = await Promise.all([
    getPublicProfile(user.id, user),
    tab === "saved" ? getSavedContent(user.id) : Promise.resolve([]),
    getContextualStories(user, { creatorId: user.id, limit: 6 }),
  ]);
  return (
    <ProfileView
      currentUserId={user.id}
      profile={profile}
      saved={saved}
      stories={stories}
      tab={tab}
    />
  );
}
