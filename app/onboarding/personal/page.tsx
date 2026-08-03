import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { getOnboardingReferenceData } from "@/lib/reference-data";
import { requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function PersonalOnboardingPage() {
  const user = await requireUser();
  const { countries, cities, universities } =
    await getOnboardingReferenceData();
  return (
    <OnboardingFlow
      cities={cities.map((item) => ({
        id: item.id,
        name: item.name,
        secondary: item.province ?? undefined,
        countryId: item.countryId,
      }))}
      completed={Boolean(user.onboardingCompletedAt)}
      countries={countries.map((item) => ({
        id: item.id,
        name: `${item.emoji ?? ""} ${item.name}`.trim(),
      }))}
      initialValues={{
        gender: user.gender,
        studentJourney: user.studentJourney,
        countryId: user.countryId,
        cityId: user.cityId,
        universityId: user.universityId,
        degree: user.degree,
        studyLevel: user.studyLevel,
        arrivalDate: user.arrivalDate?.toISOString() ?? null,
        languages: user.languages,
        interests: user.interests,
        applicationStage: user.journeyDetail?.applicationStage ?? null,
        journeyGroup: user.journeyDetail?.journeyGroup ?? null,
        journeyStage: user.journeyDetail?.journeyStage ?? null,
        universityPreferenceMode:
          user.journeyDetail?.universityPreferenceMode ?? null,
        targetCityIds: user.targetCities.map(({ cityId }) => cityId),
        targetUniversityIds: user.targetUniversities.map(
          ({ universityId }) => universityId,
        ),
        expectedIntake:
          user.journeyDetail?.expectedIntake?.toISOString() ?? null,
        campusName: user.journeyDetail?.campusName ?? null,
        graduationYear: user.journeyDetail?.graduationYear ?? null,
        professionalArea: user.journeyDetail?.professionalArea ?? null,
        currentCityName: user.journeyDetail?.currentCityName ?? null,
        chinaRelationship: user.journeyDetail?.chinaRelationship ?? null,
        currentProfessionalContext:
          user.journeyDetail?.currentProfessionalContext ?? null,
        arrivalPreparationContext:
          user.journeyDetail?.arrivalPreparationContext ?? null,
        onboardingStep: user.journeyDetail?.onboardingStep ?? 0,
      }}
      universities={universities.map((item) => ({
        id: item.id,
        name: item.name,
        secondary: [item.shortName, item.cityName].filter(Boolean).join(" · "),
        cityId: item.cityId,
        countryId: item.countryId,
      }))}
    />
  );
}
