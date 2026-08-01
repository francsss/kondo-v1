import type { Metadata } from "next";
import Link from "next/link";
import { Languages, MapPin, MessageCircle, Sparkles } from "lucide-react";
import { HousingNav } from "@/components/features/housing/HousingNav";
import {
  HOUSING_ANALYTICS_EVENTS,
  HousingAnalytics,
} from "@/components/features/housing/HousingAnalytics";
import { RoommateInterestActions } from "@/components/features/housing/RoommateInterestActions";
import { RoommateInterestButton } from "@/components/features/housing/RoommateInterestButton";
import { RoommateProfileComposer } from "@/components/features/housing/RoommateProfileComposer";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  HorizontalTabs,
  TabPanelTransition,
} from "@/components/ui/HorizontalTabs";
import { listRoommateInterests } from "@/lib/roommate-matching";
import { discoverRoommateProfiles } from "@/lib/roommate-profiles";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Roommates",
  robots: "noindex",
};

export default async function RoommatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const tab = params.tab === "interests" ? "interests" : "discover";
  const [cities, ownProfile, profiles, interests] = await Promise.all([
    prisma.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.roommateProfile.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        version: true,
        cityId: true,
        moveInDate: true,
        stayDurationMonths: true,
        budgetMaximumMinor: true,
        preferredHousingTypes: true,
        currentHousingSituation: true,
        languages: true,
        sleepSchedule: true,
        routine: true,
        cleanlinessPreference: true,
        introduction: true,
      },
    }),
    tab === "discover"
      ? discoverRoommateProfiles({
          viewerId: user.id,
          query: {
            cityId: params.cityId || undefined,
            moveInFrom: params.moveInFrom || undefined,
            moveInTo: params.moveInTo || undefined,
            maximumBudgetMinor: params.maximumBudget
              ? Math.round(Number(params.maximumBudget) * 100)
              : undefined,
            languages: params.languages
              ? params.languages
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean)
              : [],
            limit: 24,
          },
        })
      : [],
    tab === "interests" ? listRoommateInterests(user.id) : [],
  ]);
  return (
    <main className="mx-auto max-w-[1200px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <HousingAnalytics
        event={HOUSING_ANALYTICS_EVENTS.ROOMMATE_DISCOVERY_VIEWED}
        properties={{ tab }}
      />
      <HousingNav active="/housing/roommates" />
      <div className="mt-7 rounded-[2rem] border border-border bg-card p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
          Compatibility over popularity
        </p>
        <h1 className="mt-2 font-display text-3xl font-black sm:text-4xl">
          Find a compatible roommate
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
          Match through city, timing, budget, languages and living preferences.
          Private contact details stay hidden until both people connect.
        </p>
        <div className="mt-5">
          <RoommateProfileComposer
            cities={cities}
            profile={
              ownProfile
                ? {
                    version: ownProfile.version,
                    cityId: ownProfile.cityId,
                    moveInDate: ownProfile.moveInDate
                      .toISOString()
                      .slice(0, 10),
                    stayDurationMonths: ownProfile.stayDurationMonths,
                    budgetMaximum: ownProfile.budgetMaximumMinor / 100,
                    preferredHousingTypes: ownProfile.preferredHousingTypes,
                    currentHousingSituation: ownProfile.currentHousingSituation,
                    languages: ownProfile.languages,
                    sleepSchedule: ownProfile.sleepSchedule,
                    routine: ownProfile.routine,
                    cleanlinessPreference: ownProfile.cleanlinessPreference,
                    introduction: ownProfile.introduction,
                  }
                : null
            }
          />
        </div>
      </div>
      <HorizontalTabs
        activeKey={tab}
        ariaLabel="Roommate views"
        className="mt-6"
        tabs={[
          { key: "discover", label: "Discover", href: "/housing/roommates" },
          {
            key: "interests",
            label: "Interests",
            href: "/housing/roommates?tab=interests",
          },
        ]}
      />

      <TabPanelTransition index={tab === "discover" ? 0 : 1}>
        {tab === "discover" ? (
          <form
            action="/housing/roommates"
            className="mt-5 grid gap-3 rounded-3xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5"
            method="get"
          >
            <label>
              <span className="sr-only">City</span>
              <select
                className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
                defaultValue={params.cityId ?? ""}
                name="cityId"
              >
                <option value="">All cities</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Move in from</span>
              <input
                className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
                defaultValue={params.moveInFrom}
                name="moveInFrom"
                title="Move in from"
                type="date"
              />
            </label>
            <label>
              <span className="sr-only">Move in by</span>
              <input
                className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
                defaultValue={params.moveInTo}
                name="moveInTo"
                title="Move in by"
                type="date"
              />
            </label>
            <label>
              <span className="sr-only">Maximum monthly budget in CNY</span>
              <input
                className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
                defaultValue={params.maximumBudget}
                min="0"
                name="maximumBudget"
                placeholder="Max budget (CNY)"
                type="number"
              />
            </label>
            <Button type="submit">Find matches</Button>
          </form>
        ) : null}

        {tab === "interests" ? (
          interests.length ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {interests.map((interest) => {
                const received = interest.recipient.id === user.id;
                const person = received ? interest.sender : interest.recipient;
                return (
                  <Card key={interest.id}>
                    <div className="flex items-center gap-3">
                      <Avatar
                        firstName={person.firstName}
                        lastName={person.lastName}
                        mediaId={person.avatarMediaId}
                      />
                      <div>
                        <p className="font-display text-lg font-black">
                          {person.firstName} {person.lastName}
                        </p>
                        <p className="text-xs font-bold text-muted-foreground">
                          {received
                            ? "Interested in your profile"
                            : "Interest sent"}
                        </p>
                      </div>
                    </div>
                    {interest.message ? (
                      <p className="mt-4 rounded-2xl bg-muted/45 p-3 text-sm leading-6">
                        {interest.message}
                      </p>
                    ) : null}
                    <div className="mt-5">
                      <RoommateInterestActions
                        conversationId={interest.conversationId}
                        direction={received ? "RECEIVED" : "SENT"}
                        interestId={interest.id}
                        status={interest.status}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="mt-6 py-14 text-center">
              <MessageCircle className="mx-auto h-8 w-8 text-kondo-green" />
              <h2 className="mt-3 font-display text-xl font-black">
                No roommate interests yet
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Sent and received interests will appear here.
              </p>
            </Card>
          )
        ) : profiles.length ? (
          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {profiles.map((profile) => (
              <Card className="flex flex-col" key={profile.id}>
                <div className="flex items-center gap-3">
                  <Avatar
                    firstName={profile.person.firstName}
                    lastName={profile.person.lastName}
                    mediaId={profile.person.avatarMediaId}
                  />
                  <div className="min-w-0">
                    <Link
                      className="font-display text-lg font-black hover:text-kondo-green"
                      href={`/housing/roommates/${profile.id}`}
                    >
                      {profile.person.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Move-in{" "}
                      {new Date(profile.moveInDate).toLocaleDateString("en")}
                    </p>
                  </div>
                </div>
                <p className="mt-4 line-clamp-4 text-sm leading-6 text-muted-foreground">
                  {profile.introduction}
                </p>
                <div className="mt-4 space-y-2 text-xs font-semibold text-muted-foreground">
                  {profile.city ? (
                    <p className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" /> {profile.city.name}
                    </p>
                  ) : null}
                  {profile.languages.length ? (
                    <p className="flex items-center gap-2">
                      <Languages className="h-3.5 w-3.5" />{" "}
                      {profile.languages.slice(0, 3).join(", ")}
                    </p>
                  ) : null}
                </div>
                {profile.matchReasons.length ? (
                  <div className="mt-4 rounded-2xl bg-kondo-green/8 p-3">
                    <p className="flex items-center gap-2 text-xs font-black text-kondo-green">
                      <Sparkles className="h-3.5 w-3.5" />
                      {profile.matchReasons.join(" · ")}
                    </p>
                  </div>
                ) : null}
                <div className="mt-auto pt-5">
                  <RoommateInterestButton recipientUserId={profile.userId} />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mt-7 py-14 text-center">
            <h2 className="font-display text-xl font-black">No matches yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create an active profile so Kondo can start finding compatible
              people.
            </p>
          </Card>
        )}
      </TabPanelTransition>
    </main>
  );
}
