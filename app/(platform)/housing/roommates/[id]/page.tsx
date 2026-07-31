import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoommateInterestButton } from "@/components/features/housing/RoommateInterestButton";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import {
  getRoommateProfile,
  RoommateProfileError,
} from "@/lib/roommate-profiles";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Roommate profile",
  robots: "noindex",
};

export default async function RoommateProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  let profile;
  try {
    profile = await getRoommateProfile({
      viewerId: user.id,
      profileId: (await params).id,
    });
  } catch (error) {
    if (error instanceof RoommateProfileError && error.status === 404)
      notFound();
    throw error;
  }
  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-8 sm:px-6 lg:pb-16 lg:pt-12">
      <Card className="p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <Avatar
            className="h-16 w-16"
            firstName={profile.person.firstName}
            lastName={profile.person.lastName}
            mediaId={profile.person.avatarMediaId}
          />
          <div>
            <h1 className="font-display text-3xl font-black">
              {profile.person.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile.city?.name ?? "Location shared after connection"}
            </p>
          </div>
        </div>
        <p className="mt-7 whitespace-pre-wrap leading-7 text-muted-foreground">
          {profile.introduction}
        </p>
        <dl className="mt-7 grid gap-4 sm:grid-cols-2">
          {[
            ["Move-in", new Date(profile.moveInDate).toLocaleDateString("en")],
            [
              "Budget",
              `${profile.currency} ${Math.round(profile.budgetMaximumMinor / 100)}/month`,
            ],
            ["Languages", profile.languages.join(", ") || "Not specified"],
            [
              "Housing",
              profile.preferredHousingTypes
                .map((value) => value.toLowerCase().replaceAll("_", " "))
                .join(", "),
            ],
            ["Sleep schedule", profile.sleepSchedule ?? "Not specified"],
            ["Cleanliness", profile.cleanlinessPreference ?? "Not specified"],
          ].map(([label, value]) => (
            <div className="rounded-2xl bg-muted/45 p-4" key={label}>
              <dt className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                {label}
              </dt>
              <dd className="mt-1 text-sm font-bold">{value}</dd>
            </div>
          ))}
        </dl>
        {profile.matchReasons.length ? (
          <div className="mt-7 rounded-2xl bg-kondo-green/10 p-4 text-sm font-bold text-kondo-green">
            Why you may match: {profile.matchReasons.join(" · ")}
          </div>
        ) : null}
        {!profile.owner ? (
          <div className="mt-7">
            <RoommateInterestButton recipientUserId={profile.userId} />
          </div>
        ) : null}
      </Card>
    </main>
  );
}
