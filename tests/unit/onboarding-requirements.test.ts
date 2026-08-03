import { describe, expect, it } from "vitest";
import {
  missingOrganizationOnboardingRequirement,
  missingPersonalOnboardingRequirement,
  type PersonalOnboardingState,
} from "@/lib/onboarding-requirements";

const collected = { needsGender: false, needsCountry: false };

function personalForm(
  overrides: Partial<PersonalOnboardingState> = {},
): PersonalOnboardingState {
  return {
    gender: "",
    countryId: "",
    journeyGroup: "",
    journeyStage: "",
    studentJourney: "",
    cityId: "",
    universityId: "",
    degree: "",
    studyLevel: "",
    universityPreferenceMode: "NOT_CHOSEN",
    targetUniversityIds: [],
    currentCityName: "",
    professionalArea: "",
    chinaRelationship: "",
    languages: ["English"],
    ...overrides,
  };
}

const currentStudent = {
  journeyGroup: "STUDYING_AND_LIVING_IN_CHINA",
  journeyStage: "CURRENT_STUDENT",
  studentJourney: "CURRENT_STUDENT",
};

describe("personal onboarding step requirements", () => {
  it("blocks the journey step until a real journey is chosen", () => {
    expect(
      missingPersonalOnboardingRequirement(personalForm(), 0, collected),
    ).toBe("Choose the journey that describes you.");
  });

  it("does not ask again for gender and country collected at registration", () => {
    expect(
      missingPersonalOnboardingRequirement(
        personalForm(currentStudent),
        0,
        collected,
      ),
    ).toBe("");
  });

  it("asks for gender and country only when the account is missing them", () => {
    const form = personalForm(currentStudent);
    const missingBoth = { needsGender: true, needsCountry: true };
    expect(missingPersonalOnboardingRequirement(form, 0, missingBoth)).toBe(
      "Select your gender.",
    );
    expect(
      missingPersonalOnboardingRequirement(
        personalForm({ ...currentStudent, gender: "FEMALE" }),
        0,
        missingBoth,
      ),
    ).toBe("Select your country of origin.");
  });

  it("names each missing campus and program field in order", () => {
    const base = personalForm(currentStudent);
    expect(missingPersonalOnboardingRequirement(base, 1, collected)).toBe(
      "Select your study city.",
    );
    expect(
      missingPersonalOnboardingRequirement(
        { ...base, cityId: "city" },
        1,
        collected,
      ),
    ).toBe("Select your university.");
    expect(
      missingPersonalOnboardingRequirement(
        { ...base, cityId: "city", universityId: "university" },
        1,
        collected,
      ),
    ).toBe("Add your program or study field.");
    expect(
      missingPersonalOnboardingRequirement(
        {
          ...base,
          cityId: "city",
          universityId: "university",
          degree: "Computer Science",
        },
        1,
        collected,
      ),
    ).toBe("Select your study level.");
    expect(
      missingPersonalOnboardingRequirement(
        {
          ...base,
          cityId: "city",
          universityId: "university",
          degree: "Computer Science",
          studyLevel: "BACHELORS",
        },
        1,
        collected,
      ),
    ).toBe("");
  });

  it("never asks a prospective student for a campus they have not joined", () => {
    const prospective = personalForm({
      journeyGroup: "PREPARING_FOR_CHINA",
      journeyStage: "EXPLORING",
      studentJourney: "PROSPECTIVE_STUDENT",
      studyLevel: "BACHELORS",
    });
    expect(
      missingPersonalOnboardingRequirement(prospective, 1, collected),
    ).toBe("");
  });

  it("requires a shortlist only when preferred universities are claimed", () => {
    const prospective = personalForm({
      journeyGroup: "PREPARING_FOR_CHINA",
      journeyStage: "EXPLORING",
      studentJourney: "PROSPECTIVE_STUDENT",
      studyLevel: "BACHELORS",
      universityPreferenceMode: "PREFERRED_SELECTED",
    });
    expect(missingPersonalOnboardingRequirement(prospective, 1, collected)).toBe(
      "Select at least one preferred university.",
    );
    expect(
      missingPersonalOnboardingRequirement(
        { ...prospective, targetUniversityIds: ["university"] },
        1,
        collected,
      ),
    ).toBe("");
  });

  it("lets alumni through without any required study detail", () => {
    expect(
      missingPersonalOnboardingRequirement(
        personalForm({
          journeyGroup: "CAREER_ALUMNI_AND_ENTREPRENEURSHIP",
          journeyStage: "ALUMNI",
          studentJourney: "ALUMNI",
        }),
        1,
        collected,
      ),
    ).toBe("");
  });

  it("asks professionals only for professional context", () => {
    const professional = personalForm({
      journeyGroup: "CAREER_ALUMNI_AND_ENTREPRENEURSHIP",
      journeyStage: "PROFESSIONAL",
      studentJourney: "PROFESSIONAL",
    });
    expect(
      missingPersonalOnboardingRequirement(professional, 1, collected),
    ).toBe("Add your current city.");
    expect(
      missingPersonalOnboardingRequirement(
        {
          ...professional,
          currentCityName: "Shanghai",
          professionalArea: "Education",
          chinaRelationship: "I support incoming students.",
        },
        1,
        collected,
      ),
    ).toBe("");
  });

  it("keeps the schema minimum of one language on the final step", () => {
    expect(
      missingPersonalOnboardingRequirement(
        personalForm({ languages: [] }),
        2,
        collected,
      ),
    ).toBe("Add at least one language you speak.");
    expect(
      missingPersonalOnboardingRequirement(personalForm(), 2, collected),
    ).toBe("");
  });
});

describe("organization onboarding step requirements", () => {
  const organization = {
    publicName: "",
    type: "",
    countryId: "",
    capabilities: [] as string[],
    shortDescription: "",
  };

  it("names each missing identity field in order", () => {
    expect(missingOrganizationOnboardingRequirement(organization, 0)).toBe(
      "Add the public organization name.",
    );
    expect(
      missingOrganizationOnboardingRequirement(
        { ...organization, publicName: "Kondo Association" },
        0,
      ),
    ).toBe("Select the organization type.");
    expect(
      missingOrganizationOnboardingRequirement(
        {
          ...organization,
          publicName: "Kondo Association",
          type: "STUDENT_ASSOCIATION",
        },
        0,
      ),
    ).toBe("Select the country.");
  });

  it("requires an activity area and a usable description on one step", () => {
    const identified = {
      ...organization,
      publicName: "Kondo Association",
      type: "STUDENT_ASSOCIATION",
      countryId: "country",
    };
    expect(missingOrganizationOnboardingRequirement(identified, 1)).toBe(
      "Select at least one activity area.",
    );
    expect(
      missingOrganizationOnboardingRequirement(
        { ...identified, capabilities: ["STUDENT_SERVICES"], shortDescription: "Too short" },
        1,
      ),
    ).toBe("Write a short description of at least 20 characters.");
    expect(
      missingOrganizationOnboardingRequirement(
        {
          ...identified,
          capabilities: ["STUDENT_SERVICES"],
          shortDescription:
            "Practical support for students preparing to study in China.",
        },
        1,
      ),
    ).toBe("");
  });

  it("never blocks the review step", () => {
    expect(missingOrganizationOnboardingRequirement(organization, 2)).toBe("");
  });
});
