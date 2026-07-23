import { KondoLogo } from "@/components/KondoLogo";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { getOnboardingReferenceData } from "@/lib/reference-data";
import { requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();
  const { countries, cities, universities } =
    await getOnboardingReferenceData();
  return (
    <main className="min-h-screen bg-background px-5 py-6 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <KondoLogo />
        <OnboardingFlow
          countries={countries.map((item) => ({
            id: item.id,
            name: `${item.emoji ?? ""} ${item.name}`,
          }))}
          cities={cities.map((item) => ({
            id: item.id,
            name: item.name,
            secondary: item.province ?? undefined,
            countryId: item.countryId,
          }))}
          completed={Boolean(user.onboardingCompletedAt)}
          initialValues={{
            countryId: user.countryId,
            cityId: user.cityId,
            universityId: user.universityId,
            degree: user.degree,
            studyLevel: user.studyLevel,
            arrivalDate: user.arrivalDate?.toISOString() ?? null,
            languages: user.languages,
            interests: user.interests,
          }}
          universities={universities.map((item) => ({
            id: item.id,
            name: item.name,
            secondary: [item.shortName, item.cityName]
              .filter(Boolean)
              .join(" · "),
            cityId: item.cityId,
            countryId: item.countryId,
          }))}
        />
      </div>
    </main>
  );
}
