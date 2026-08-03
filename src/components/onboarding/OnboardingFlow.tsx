"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, GraduationCap, MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChoiceCards,
  ChoiceChips,
  DateField,
  FieldGrid,
  FieldSection,
  MultiSelectField,
  TextAreaField,
  TextField,
  TogglePills,
  TokenField,
} from "@/components/onboarding/fields";
import {
  OnboardingShell,
  type OnboardingStepDefinition,
} from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  JOURNEY_GROUP_PRESENTATION,
  JOURNEY_GROUPS,
  JOURNEY_STAGES_BY_GROUP,
  inferJourney,
  journeyStageLabel,
  legacyJourneyFor,
} from "@/lib/journey";
import { missingPersonalOnboardingRequirement } from "@/lib/onboarding-requirements";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

type Option = { id: string; name: string; secondary?: string };
type CityOption = Option & { countryId: string };
type UniversityOption = Option & { cityId: string; countryId: string };
type StudyLevel =
  "LANGUAGE" | "BACHELORS" | "MASTERS" | "DOCTORATE" | "EXCHANGE" | "OTHER";
type StudentJourney =
  | "PROSPECTIVE_STUDENT"
  | "ADMITTED_STUDENT"
  | "CURRENT_STUDENT"
  | "ALUMNI"
  | "PROFESSIONAL"
  | "INCOMING_STUDENT";
type JourneyGroup = (typeof JOURNEY_GROUPS)[number];
type JourneyStage = (typeof JOURNEY_STAGES_BY_GROUP)[JourneyGroup][number];

type InitialValues = {
  gender: "MALE" | "FEMALE" | null;
  studentJourney: StudentJourney | null;
  countryId: string | null;
  cityId: string | null;
  universityId: string | null;
  degree: string | null;
  studyLevel: StudyLevel | null;
  arrivalDate: string | null;
  languages: string[];
  interests: string[];
  applicationStage: string | null;
  journeyGroup: JourneyGroup | null;
  journeyStage: JourneyStage | null;
  universityPreferenceMode: string | null;
  targetCityIds: string[];
  targetUniversityIds: string[];
  expectedIntake: string | null;
  campusName: string | null;
  graduationYear: number | null;
  professionalArea: string | null;
  currentCityName: string | null;
  chinaRelationship: string | null;
  currentProfessionalContext: string | null;
  arrivalPreparationContext: string | null;
  onboardingStep: number;
};

type OnboardingForm = {
  gender: string;
  studentJourney: StudentJourney | "";
  countryId: string;
  cityId: string;
  universityId: string;
  degree: string;
  studyLevel: StudyLevel | "";
  arrivalDate: string;
  languages: string[];
  interests: string[];
  applicationStage: string;
  journeyGroup: JourneyGroup | "";
  journeyStage: JourneyStage | "";
  universityPreferenceMode: string;
  targetCityIds: string[];
  targetUniversityIds: string[];
  expectedIntake: string;
  campusName: string;
  graduationYear: string;
  professionalArea: string;
  currentCityName: string;
  chinaRelationship: string;
  currentProfessionalContext: string;
  arrivalPreparationContext: string;
};

type FormSetter = React.Dispatch<React.SetStateAction<OnboardingForm>>;

const INTEREST_OPTIONS = [
  { value: "Housing", label: "Housing", icon: "🏠" },
  { value: "Roommate", label: "Roommate", icon: "🧑🏾‍🤝‍🧑🏿" },
  { value: "Community", label: "Community", icon: "🌍" },
  { value: "Marketplace", label: "Marketplace", icon: "🛍️" },
  { value: "Internship", label: "Internship", icon: "💼" },
  { value: "Scholarship", label: "Scholarship", icon: "🏅" },
  { value: "Student Guide", label: "Student Guide", icon: "🧭" },
] as const;

const LANGUAGE_SUGGESTIONS = [
  "English",
  "French",
  "Chinese",
  "Arabic",
  "Portuguese",
  "Swahili",
  "Spanish",
] as const;

const STUDY_LEVEL_OPTIONS = [
  { value: "LANGUAGE", label: "Language" },
  { value: "BACHELORS", label: "Bachelor’s" },
  { value: "MASTERS", label: "Master’s" },
  { value: "DOCTORATE", label: "Doctorate" },
  { value: "EXCHANGE", label: "Exchange" },
  { value: "OTHER", label: "Other" },
] as const satisfies readonly { value: StudyLevel; label: string }[];

const UNIVERSITY_PREFERENCE_OPTIONS = [
  {
    value: "NOT_CHOSEN",
    label: "I have not chosen a university yet",
    description: "Kondo will suggest options as you explore.",
  },
  {
    value: "CONSIDERING_SEVERAL",
    label: "I am considering several universities",
    description: "Shortlist them below so we can follow their deadlines.",
  },
  {
    value: "PREFERRED_SELECTED",
    label: "I already have preferred universities",
    description: "Pick them below to get targeted guidance.",
  },
] as const;

/**
 * Titles adapt to the selected journey so the middle step never asks a
 * question that does not belong to this member's situation.
 */
function profileStepCopy(journey: StudentJourney | ""): {
  title: string;
  description: string;
} {
  if (journey === "PROFESSIONAL") {
    return {
      title: "Tell us about your work",
      description:
        "This helps Kondo connect you with the right students, alumni and organizations.",
    };
  }
  if (journey === "ALUMNI") {
    return {
      title: "Your studies and where you are now",
      description:
        "Everything here is optional. Share what helps others recognise your experience.",
    };
  }
  if (journey === "PROSPECTIVE_STUDENT") {
    return {
      title: "What are you aiming for?",
      description:
        "Only your study plans. Nothing about a campus you have not joined yet.",
    };
  }
  if (journey === "ADMITTED_STUDENT") {
    return {
      title: "Your admission and arrival",
      description:
        "This unlocks arrival guidance for your city and university.",
    };
  }
  return {
    title: "Your university life",
    description:
      "This connects you to your campus, your city and the students around you.",
  };
}

function buildSteps(journey: StudentJourney | ""): OnboardingStepDefinition[] {
  const profile = profileStepCopy(journey);
  return [
    {
      key: "journey",
      label: "Your journey",
      title: "Where are you in your China journey?",
      description:
        "Kondo builds the rest of this form around your answer. You can change it later from Settings.",
    },
    {
      key: "profile",
      label: "Your details",
      title: profile.title,
      description: profile.description,
    },
    {
      key: "focus",
      label: "Your focus",
      title: "What should Kondo bring you first?",
      description:
        "Pick what matters right now. Everything stays editable from Settings.",
    },
  ];
}

function toOptional(value: string) {
  return value.trim() || undefined;
}

export function OnboardingFlow({
  countries,
  cities,
  universities,
  initialValues,
  completed,
}: {
  countries: Option[];
  cities: CityOption[];
  universities: UniversityOption[];
  initialValues: InitialValues;
  completed: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const stepStartedAt = useRef<number | null>(null);
  const initialJourney =
    initialValues.studentJourney === "INCOMING_STUDENT"
      ? "INCOMING_STUDENT"
      : initialValues.studentJourney &&
          [
            "PROSPECTIVE_STUDENT",
            "ADMITTED_STUDENT",
            "CURRENT_STUDENT",
            "ALUMNI",
            "PROFESSIONAL",
          ].includes(initialValues.studentJourney)
        ? initialValues.studentJourney
        : "";
  /**
   * `inferJourney` always returns a fallback group. Applying it to a brand new
   * account would render a journey card as selected while the flow still
   * refuses to continue, so it is only used to restore a known journey.
   */
  const hasStoredJourney = Boolean(
    (initialValues.journeyGroup && initialValues.journeyStage) || initialJourney,
  );
  const initialCanonicalJourney = hasStoredJourney
    ? inferJourney({
        group: initialValues.journeyGroup,
        stage: initialValues.journeyStage,
        legacyJourney: initialValues.studentJourney,
        applicationStage: initialValues.applicationStage as never,
      })
    : { group: "" as const, stage: "" as const };
  const [form, setForm] = useState<OnboardingForm>({
    gender: initialValues.gender ?? "",
    studentJourney: initialJourney as StudentJourney | "",
    countryId: initialValues.countryId ?? "",
    cityId: initialValues.cityId ?? "",
    universityId: initialValues.universityId ?? "",
    degree: initialValues.degree ?? "",
    studyLevel: initialValues.studyLevel ?? "",
    arrivalDate: initialValues.arrivalDate?.slice(0, 10) ?? "",
    languages: initialValues.languages.length
      ? initialValues.languages
      : ["English"],
    interests: initialValues.interests,
    applicationStage: initialValues.applicationStage ?? "EXPLORING",
    journeyGroup: initialCanonicalJourney.group,
    journeyStage: initialCanonicalJourney.stage,
    universityPreferenceMode:
      initialValues.universityPreferenceMode ?? "NOT_CHOSEN",
    targetCityIds: initialValues.targetCityIds,
    targetUniversityIds: initialValues.targetUniversityIds,
    expectedIntake: initialValues.expectedIntake?.slice(0, 10) ?? "",
    campusName: initialValues.campusName ?? "",
    graduationYear: initialValues.graduationYear?.toString() ?? "",
    professionalArea: initialValues.professionalArea ?? "",
    currentCityName: initialValues.currentCityName ?? "",
    chinaRelationship: initialValues.chinaRelationship ?? "",
    currentProfessionalContext: initialValues.currentProfessionalContext ?? "",
    arrivalPreparationContext: initialValues.arrivalPreparationContext ?? "",
  });

  const steps = useMemo(
    () => buildSteps(form.studentJourney),
    [form.studentJourney],
  );
  const [step, setStep] = useState(() =>
    Math.min(Math.max(initialValues.onboardingStep ?? 0, 0), 2),
  );

  /**
   * Registration already collects gender and country of origin for personal
   * accounts. They are only asked again when the account genuinely lacks them
   * (organization operators and legacy accounts), never as a repeat question.
   */
  const needsGender = !initialValues.gender;
  const needsCountry = !initialValues.countryId;

  const availableUniversities = useMemo(
    () =>
      universities.filter((university) => university.cityId === form.cityId),
    [form.cityId, universities],
  );
  const targetUniversities = useMemo(
    () =>
      form.targetCityIds.length
        ? universities.filter((university) =>
            form.targetCityIds.includes(university.cityId),
          )
        : universities,
    [form.targetCityIds, universities],
  );

  useEffect(() => {
    if (!completed) {
      captureProductEvent(PRODUCT_EVENTS.ONBOARDING_STARTED);
    }
  }, [completed]);

  useEffect(() => {
    stepStartedAt.current = Date.now();
    captureProductEvent(PRODUCT_EVENTS.ONBOARDING_STEP_REACHED, {
      step: steps[step].key,
      step_number: step + 1,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Journey changes rewrite step copy but must not re-emit a step event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function requestBody(nextStep = step) {
    return {
      gender: form.gender || undefined,
      studentJourney: form.studentJourney || undefined,
      countryId: form.countryId || undefined,
      cityId: form.cityId || undefined,
      universityId: form.universityId || undefined,
      degree: toOptional(form.degree),
      studyLevel: form.studyLevel || undefined,
      arrivalDate: form.arrivalDate || undefined,
      languages: form.languages,
      interests: form.interests,
      applicationStage:
        form.studentJourney === "PROSPECTIVE_STUDENT"
          ? form.applicationStage
          : undefined,
      journeyGroup: form.journeyGroup || undefined,
      journeyStage: form.journeyStage || undefined,
      universityPreferenceMode:
        form.studentJourney === "PROSPECTIVE_STUDENT"
          ? form.universityPreferenceMode
          : undefined,
      targetCityIds:
        form.studentJourney === "PROSPECTIVE_STUDENT" ? form.targetCityIds : [],
      targetUniversityIds:
        form.studentJourney === "PROSPECTIVE_STUDENT"
          ? form.targetUniversityIds
          : [],
      expectedIntake: form.expectedIntake || undefined,
      campusName: toOptional(form.campusName),
      graduationYear: form.graduationYear
        ? Number(form.graduationYear)
        : undefined,
      professionalArea: toOptional(form.professionalArea),
      currentCityName: toOptional(form.currentCityName),
      chinaRelationship: toOptional(form.chinaRelationship),
      currentProfessionalContext: toOptional(form.currentProfessionalContext),
      arrivalPreparationContext: toOptional(form.arrivalPreparationContext),
      onboardingStep: nextStep,
    };
  }

  async function save(method: "PATCH" | "PUT", nextStep = step) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/onboarding", {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody(nextStep)),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        captureProductEvent(PRODUCT_EVENTS.ONBOARDING_VALIDATION_ERROR, {
          step: steps[step].key,
          status: response.status,
          error_type: "invalid_step",
        });
        setError(data.error ?? "Please check your answers.");
        return false;
      }
      return true;
    } catch {
      setError("Kondo could not save your profile. Please try again.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function continueToNextStep() {
    const next = Math.min(step + 1, steps.length - 1);
    if (!(await save("PATCH", next))) return;
    captureProductEvent(PRODUCT_EVENTS.ONBOARDING_STEP_COMPLETED, {
      step: steps[step].key,
      step_number: step + 1,
      duration_seconds: stepStartedAt.current
        ? Math.round((Date.now() - stepStartedAt.current) / 1_000)
        : 0,
    });
    setStep(next);
  }

  async function finish() {
    if (!(await save("PUT", steps.length))) return;
    captureProductEvent(PRODUCT_EVENTS.ONBOARDING_COMPLETED, {
      journey: form.studentJourney,
    });
    if (!completed) {
      window.sessionStorage.setItem("kondo:onboarding-completed", "1");
    }
    router.push("/home");
    router.refresh();
  }

  const missing = missingPersonalOnboardingRequirement(form, step, {
    needsGender,
    needsCountry,
  });
  const canContinue = !missing;
  const isLastStep = step === steps.length - 1;

  return (
    <OnboardingShell
      action={
        isLastStep ? (
          <Button disabled={loading || !canContinue} onClick={finish}>
            {loading ? "Saving…" : completed ? "Save changes" : "Finish"}
            {!loading ? <Check className="h-4 w-4" /> : null}
          </Button>
        ) : (
          <Button
            disabled={loading || !canContinue}
            onClick={continueToNextStep}
          >
            {loading ? "Saving…" : "Continue"}
            {!loading ? <ArrowRight className="h-4 w-4" /> : null}
          </Button>
        )
      }
      backDisabled={loading || step === 0}
      error={error}
      eyebrow={completed ? "Edit your profile" : "Welcome to Kondo"}
      headerAction={
        completed ? (
          <Button asChild size="sm" variant="ghost">
            <Link href="/settings">Exit editing</Link>
          </Button>
        ) : null
      }
      hint={missing}
      onBack={() => setStep((value) => Math.max(0, value - 1))}
      step={step}
      steps={steps}
    >
      {step === 0 ? (
        <JourneyStep
          countries={countries}
          form={form}
          needsCountry={needsCountry}
          needsGender={needsGender}
          setForm={setForm}
        />
      ) : null}
      {step === 1 ? (
        <ProfileStep
          availableUniversities={availableUniversities}
          cities={cities}
          form={form}
          setForm={setForm}
          targetUniversities={targetUniversities}
          universities={universities}
        />
      ) : null}
      {step === 2 ? <FocusStep form={form} setForm={setForm} /> : null}
    </OnboardingShell>
  );
}

function JourneyStep({
  form,
  setForm,
  countries,
  needsGender,
  needsCountry,
}: {
  form: OnboardingForm;
  setForm: FormSetter;
  countries: Option[];
  needsGender: boolean;
  needsCountry: boolean;
}) {
  return (
    <div className="grid gap-7">
      <ChoiceCards
        onSelect={(group) => {
          const stage = JOURNEY_STAGES_BY_GROUP[group][0];
          setForm((current) => ({
            ...current,
            journeyGroup: group,
            journeyStage: stage,
            studentJourney: legacyJourneyFor(group, stage),
            applicationStage:
              group === "PREPARING_FOR_CHINA" ? stage : current.applicationStage,
          }));
          captureProductEvent(PRODUCT_EVENTS.PERSONAL_JOURNEY_SELECTED, {
            journey: group,
          });
        }}
        options={JOURNEY_GROUPS.map((group) => ({
          value: group,
          label: JOURNEY_GROUP_PRESENTATION[group].label,
          description: JOURNEY_GROUP_PRESENTATION[group].description,
          icon: JOURNEY_GROUP_PRESENTATION[group].icon,
        }))}
        selected={form.journeyGroup}
      />

      {form.journeyGroup ? (
        <ChoiceChips
          label="Where are you now?"
          onSelect={(stage) =>
            setForm((current) => ({
              ...current,
              journeyStage: stage,
              studentJourney: legacyJourneyFor(
                current.journeyGroup as JourneyGroup,
                stage,
              ),
              applicationStage:
                current.journeyGroup === "PREPARING_FOR_CHINA"
                  ? stage
                  : current.applicationStage,
            }))
          }
          options={JOURNEY_STAGES_BY_GROUP[form.journeyGroup].map((stage) => ({
            value: stage,
            label: journeyStageLabel(stage),
          }))}
          selected={form.journeyStage}
        />
      ) : null}

      {needsGender || needsCountry ? (
        <FieldSection
          hint="Kondo did not collect this when your account was created."
          title="A couple of missing details"
        >
          {needsGender ? (
            <ChoiceChips
              hint="Used privately to improve Meet compatibility."
              label="Gender"
              onSelect={(gender) =>
                setForm((current) => ({ ...current, gender }))
              }
              options={[
                { value: "MALE", label: "Man" },
                { value: "FEMALE", label: "Woman" },
              ]}
              selected={form.gender}
            />
          ) : null}
          {needsCountry ? (
            <SearchableSelect
              emptyMessage="No country matches your search."
              label="Country of origin"
              onSelect={(countryId) =>
                setForm((current) => ({ ...current, countryId }))
              }
              options={countries}
              placeholder="Select your country"
              searchPlaceholder="Search countries…"
              selected={form.countryId}
            />
          ) : null}
        </FieldSection>
      ) : null}

      {form.studentJourney === "INCOMING_STUDENT" ? (
        <p className="rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
          Your legacy “Incoming student” status is preserved. Choose a journey
          above only when you are ready to clarify it.
        </p>
      ) : null}
    </div>
  );
}

/**
 * One screen per journey. Context and study plans used to be two separate
 * steps asking for fields that belong to the same mental question.
 */
function ProfileStep({
  form,
  setForm,
  cities,
  universities,
  availableUniversities,
  targetUniversities,
}: {
  form: OnboardingForm;
  setForm: FormSetter;
  cities: CityOption[];
  universities: UniversityOption[];
  availableUniversities: UniversityOption[];
  targetUniversities: UniversityOption[];
}) {
  if (form.studentJourney === "PROFESSIONAL") {
    return (
      <div className="grid gap-6">
        <FieldGrid>
          <TextField
            label="Current city"
            onChange={(currentCityName) =>
              setForm((current) => ({ ...current, currentCityName }))
            }
            placeholder="Douala, Shanghai, Paris…"
            value={form.currentCityName}
          />
          <TextField
            label="Professional area"
            onChange={(professionalArea) =>
              setForm((current) => ({ ...current, professionalArea }))
            }
            placeholder="Education, technology, trade…"
            value={form.professionalArea}
          />
        </FieldGrid>
        <TextAreaField
          hint="What you do, what you are building, or what you are looking for."
          label="Your professional connection with China"
          maxLength={500}
          onChange={(chinaRelationship) =>
            setForm((current) => ({ ...current, chinaRelationship }))
          }
          placeholder="I work with Chinese universities and support incoming students…"
          value={form.chinaRelationship}
        />
      </div>
    );
  }

  if (form.studentJourney === "PROSPECTIVE_STUDENT") {
    return (
      <div className="grid gap-7">
        <FieldSection title="Your university plans">
          <ChoiceCards
            onSelect={(value) =>
              setForm((current) => ({
                ...current,
                universityPreferenceMode: value,
                targetUniversityIds:
                  value === "NOT_CHOSEN" ? [] : current.targetUniversityIds,
              }))
            }
            options={UNIVERSITY_PREFERENCE_OPTIONS}
            selected={form.universityPreferenceMode}
          />
          <MultiSelectField
            hint="Optional. Helps Kondo surface the right cost of living and housing."
            label="Preferred Chinese cities"
            onChange={(targetCityIds) =>
              setForm((current) => ({
                ...current,
                targetCityIds,
                targetUniversityIds: current.targetUniversityIds.filter((id) => {
                  const university = universities.find(
                    (option) => option.id === id,
                  );
                  return (
                    !targetCityIds.length ||
                    Boolean(
                      university && targetCityIds.includes(university.cityId),
                    )
                  );
                }),
              }))
            }
            options={cities}
            searchPlaceholder="Search cities or provinces…"
            selected={form.targetCityIds}
          />
          {form.universityPreferenceMode !== "NOT_CHOSEN" ? (
            <MultiSelectField
              label="Preferred universities"
              onChange={(targetUniversityIds) =>
                setForm((current) => ({ ...current, targetUniversityIds }))
              }
              options={targetUniversities}
              searchPlaceholder="Search universities…"
              selected={form.targetUniversityIds}
            />
          ) : null}
        </FieldSection>

        <FieldSection title="Your study goal">
          <TextField
            label="Intended field or education goal"
            onChange={(degree) => setForm((current) => ({ ...current, degree }))}
            placeholder="Computer Science"
            value={form.degree}
          />
          <ChoiceChips
            label="Study level"
            onSelect={(studyLevel) =>
              setForm((current) => ({ ...current, studyLevel }))
            }
            options={STUDY_LEVEL_OPTIONS}
            selected={form.studyLevel}
          />
          <FieldGrid>
            <DateField
              label="Expected intake (optional)"
              onChange={(expectedIntake) =>
                setForm((current) => ({ ...current, expectedIntake }))
              }
              value={form.expectedIntake}
            />
            <DateField
              label="Expected arrival date (optional)"
              onChange={(arrivalDate) =>
                setForm((current) => ({ ...current, arrivalDate }))
              }
              value={form.arrivalDate}
            />
          </FieldGrid>
        </FieldSection>
      </div>
    );
  }

  if (form.studentJourney === "ALUMNI") {
    return (
      <div className="grid gap-7">
        <FieldSection title="Where you studied">
          <SearchableSelect
            clearLabel="No former study city selected"
            icon={<MapPin />}
            label="Former study city (optional)"
            onSelect={(cityId) =>
              setForm((current) => ({
                ...current,
                cityId,
                universityId: universities.some(
                  (university) =>
                    university.id === current.universityId &&
                    university.cityId === cityId,
                )
                  ? current.universityId
                  : "",
              }))
            }
            options={cities}
            placeholder="Select a city"
            searchPlaceholder="Search cities or provinces…"
            selected={form.cityId}
          />
          <SearchableSelect
            clearLabel="No former university selected"
            disabled={!form.cityId}
            emptyMessage="No university is registered for this city."
            icon={<GraduationCap />}
            label="Former university (optional)"
            onSelect={(universityId) =>
              setForm((current) => ({ ...current, universityId }))
            }
            options={availableUniversities}
            placeholder={
              form.cityId ? "Select a university" : "Select a city first"
            }
            searchPlaceholder="Search universities…"
            selected={form.universityId}
          />
          <FieldGrid>
            <TextField
              inputMode="numeric"
              label="Graduation year (optional)"
              maxLength={4}
              onChange={(graduationYear) =>
                setForm((current) => ({ ...current, graduationYear }))
              }
              placeholder="2024"
              value={form.graduationYear}
            />
            <TextField
              label="Current city (optional)"
              onChange={(currentCityName) =>
                setForm((current) => ({ ...current, currentCityName }))
              }
              placeholder="Douala, Shanghai, Paris…"
              value={form.currentCityName}
            />
          </FieldGrid>
        </FieldSection>
        <TextAreaField
          label="What you do now (optional)"
          maxLength={500}
          onChange={(currentProfessionalContext) =>
            setForm((current) => ({ ...current, currentProfessionalContext }))
          }
          placeholder="Share what you do now or what kind of connections you are looking for."
          value={form.currentProfessionalContext}
        />
      </div>
    );
  }

  const admitted = form.studentJourney === "ADMITTED_STUDENT";
  return (
    <div className="grid gap-7">
      <FieldSection title={admitted ? "Where you are admitted" : "Your campus"}>
        <SearchableSelect
          icon={<MapPin />}
          label="Study city"
          onSelect={(cityId) =>
            setForm((current) => ({
              ...current,
              cityId,
              universityId: universities.some(
                (university) =>
                  university.id === current.universityId &&
                  university.cityId === cityId,
              )
                ? current.universityId
                : "",
            }))
          }
          options={cities}
          placeholder="Select a city"
          searchPlaceholder="Search cities or provinces…"
          selected={form.cityId}
        />
        <SearchableSelect
          disabled={!form.cityId}
          emptyMessage="No university is registered for this city."
          icon={<GraduationCap />}
          label="University"
          onSelect={(universityId) =>
            setForm((current) => ({ ...current, universityId }))
          }
          options={availableUniversities}
          placeholder={
            form.cityId ? "Select a university" : "Select a city first"
          }
          searchPlaceholder="Search universities…"
          selected={form.universityId}
        />
        {form.studentJourney === "CURRENT_STUDENT" ? (
          <TextField
            label="Campus (optional)"
            onChange={(campusName) =>
              setForm((current) => ({ ...current, campusName }))
            }
            placeholder="Main campus"
            value={form.campusName}
          />
        ) : null}
      </FieldSection>

      <FieldSection title="Your program">
        <TextField
          label="Program or study field"
          onChange={(degree) => setForm((current) => ({ ...current, degree }))}
          placeholder="Computer Science"
          value={form.degree}
        />
        <ChoiceChips
          label="Study level"
          onSelect={(studyLevel) =>
            setForm((current) => ({ ...current, studyLevel }))
          }
          options={STUDY_LEVEL_OPTIONS}
          selected={form.studyLevel}
        />
        <DateField
          label={
            form.studentJourney === "CURRENT_STUDENT"
              ? "Study start or arrival date (optional)"
              : "Expected arrival date (optional)"
          }
          onChange={(arrivalDate) =>
            setForm((current) => ({ ...current, arrivalDate }))
          }
          value={form.arrivalDate}
        />
      </FieldSection>

      {admitted ? (
        <TextAreaField
          hint="Visa, housing, airport arrival, campus registration — anything you are preparing now."
          label="What are you preparing? (optional)"
          maxLength={500}
          onChange={(arrivalPreparationContext) =>
            setForm((current) => ({ ...current, arrivalPreparationContext }))
          }
          placeholder="I am preparing my visa appointment and looking for housing near campus."
          value={form.arrivalPreparationContext}
        />
      ) : null}
    </div>
  );
}

function FocusStep({
  form,
  setForm,
}: {
  form: OnboardingForm;
  setForm: FormSetter;
}) {
  return (
    <div className="grid gap-7">
      <TogglePills
        hint="Optional. Choose as many as you want."
        label="What would be useful to you?"
        onChange={(interests) => setForm((current) => ({ ...current, interests }))}
        options={INTEREST_OPTIONS}
        selected={form.interests}
      />
      <TokenField
        hint="Helps Kondo match you with students you can actually talk to."
        label="Languages you speak"
        onChange={(languages) => setForm((current) => ({ ...current, languages }))}
        placeholder="Add a language"
        suggestions={LANGUAGE_SUGGESTIONS}
        values={form.languages}
      />
    </div>
  );
}

