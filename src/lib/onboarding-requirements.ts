/**
 * Step completion rules for both onboarding flows.
 *
 * They return a friendly sentence naming the single blocking field, or an
 * empty string when the step is complete. The flows render that sentence next
 * to the primary action so a disabled button is never a dead end.
 *
 * These rules mirror `onboardingSchema` and the organization onboarding
 * schemas: they are a front-of-house courtesy, never the source of truth.
 */

export type PersonalOnboardingState = {
  gender: string;
  countryId: string;
  journeyGroup: string;
  journeyStage: string;
  studentJourney: string;
  cityId: string;
  universityId: string;
  degree: string;
  studyLevel: string;
  universityPreferenceMode: string;
  targetUniversityIds: string[];
  currentCityName: string;
  professionalArea: string;
  chinaRelationship: string;
  languages: string[];
};

export type OrganizationOnboardingState = {
  publicName: string;
  type: string;
  countryId: string;
  capabilities: string[];
  shortDescription: string;
};

export const ORGANIZATION_DESCRIPTION_MIN_LENGTH = 20;

export function missingPersonalOnboardingRequirement(
  form: PersonalOnboardingState,
  step: number,
  options: { needsGender: boolean; needsCountry: boolean },
): string {
  if (step === 0) {
    if (!form.journeyGroup || !form.journeyStage || !form.studentJourney) {
      return "Choose the journey that describes you.";
    }
    if (options.needsGender && !form.gender) return "Select your gender.";
    if (options.needsCountry && !form.countryId) {
      return "Select your country of origin.";
    }
    return "";
  }

  if (step === 1) {
    if (form.studentJourney === "PROFESSIONAL") {
      if (!form.currentCityName.trim()) return "Add your current city.";
      if (!form.professionalArea.trim()) return "Add your professional area.";
      if (!form.chinaRelationship.trim()) {
        return "Describe your professional connection with China.";
      }
      return "";
    }
    if (form.studentJourney === "PROSPECTIVE_STUDENT") {
      if (
        form.universityPreferenceMode === "PREFERRED_SELECTED" &&
        !form.targetUniversityIds.length
      ) {
        return "Select at least one preferred university.";
      }
      if (!form.degree.trim() && !form.studyLevel) {
        return "Add your intended field or study level.";
      }
      return "";
    }
    if (form.studentJourney === "ALUMNI") return "";
    if (!form.cityId) return "Select your study city.";
    if (!form.universityId) return "Select your university.";
    if (!form.degree.trim()) return "Add your program or study field.";
    if (!form.studyLevel) return "Select your study level.";
    return "";
  }

  if (!form.languages.length) return "Add at least one language you speak.";
  return "";
}

export function missingOrganizationOnboardingRequirement(
  form: OrganizationOnboardingState,
  step: number,
): string {
  if (step === 0) {
    if (form.publicName.trim().length < 2) {
      return "Add the public organization name.";
    }
    if (!form.type) return "Select the organization type.";
    if (!form.countryId) return "Select the country.";
    return "";
  }
  if (step === 1) {
    if (!form.capabilities.length) {
      return "Select at least one activity area.";
    }
    if (
      form.shortDescription.trim().length < ORGANIZATION_DESCRIPTION_MIN_LENGTH
    ) {
      return `Write a short description of at least ${ORGANIZATION_DESCRIPTION_MIN_LENGTH} characters.`;
    }
    return "";
  }
  return "";
}
