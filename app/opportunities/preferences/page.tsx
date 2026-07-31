import type { Metadata } from "next";
import { OpportunityAccountNav } from "@/components/features/opportunities/OpportunityAccountNav";
import { OpportunityProfileForm } from "@/components/features/opportunities/OpportunityProfileForm";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Opportunity preferences" };
export const dynamic = "force-dynamic";

export default async function OpportunityPreferencesPage() {
  const user = await requireUser();
  const profile = await prisma.userOpportunityProfile.findUnique({
    where: { userId: user.id },
  });
  return (
    <div className="mx-auto max-w-[900px] px-4 pb-20 pt-8 sm:px-6 lg:pt-12">
      <h1 className="text-3xl font-black tracking-[-0.04em]">
        Opportunity preferences
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Control recommendations and deadline reminders. Recommendations remain
        opt-in.
      </p>
      <OpportunityAccountNav />
      <OpportunityProfileForm
        mode="preferences"
        initial={{
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
        }}
      />
    </div>
  );
}
