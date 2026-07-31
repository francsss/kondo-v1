import type { Metadata } from "next";
import { OpportunityAccountNav } from "@/components/features/opportunities/OpportunityAccountNav";
import {
  OpportunityProfileForm,
  type OpportunityProfileValue,
} from "@/components/features/opportunities/OpportunityProfileForm";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Opportunity profile" };
export const dynamic = "force-dynamic";

function valueFromProfile(
  profile: Awaited<ReturnType<typeof loadProfile>>,
): OpportunityProfileValue {
  return {
    preferredTypes: profile?.preferredTypes ?? [],
    remotePreference: profile?.remotePreference ?? null,
    experienceLevel: profile?.experienceLevel ?? "UNSPECIFIED",
    availabilityFrom:
      profile?.availabilityFrom?.toISOString().slice(0, 10) ?? "",
    professionalInterests: profile?.professionalInterests ?? [],
    skills: profile?.skills ?? [],
    workAuthorizationNote: profile?.workAuthorizationNote ?? "",
    portfolioUrl: profile?.portfolioUrl ?? "",
    professionalProfileUrl: profile?.professionalProfileUrl ?? "",
    coverLetterTemplate: profile?.coverLetterTemplate ?? "",
    recommendationsEnabled: profile?.recommendationsEnabled ?? false,
    deadlineReminderDays: profile?.deadlineReminderDays ?? [],
  };
}

function loadProfile(userId: string) {
  return prisma.userOpportunityProfile.findUnique({ where: { userId } });
}

export default async function OpportunityProfilePage() {
  const user = await requireUser();
  const profile = await loadProfile(user.id);
  return (
    <div className="mx-auto max-w-[900px] px-4 pb-20 pt-8 sm:px-6 lg:pt-12">
      <h1 className="text-3xl font-black tracking-[-0.04em]">
        Opportunity profile
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Keep professional details ready without making them public.
      </p>
      <OpportunityAccountNav />
      <OpportunityProfileForm
        initial={valueFromProfile(profile)}
        mode="profile"
      />
    </div>
  );
}
