"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GraduationCap,
  MapPin,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  NEW_PERSONAL_JOURNEYS,
  PERSONAL_JOURNEY_PRESENTATION,
  type NewPersonalJourney,
} from "@/lib/personal-journeys";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string; secondary?: string };
type CityOption = Option & { countryId: string };
type UniversityOption = Option & { cityId: string; countryId: string };
type StudyLevel =
  "LANGUAGE" | "BACHELORS" | "MASTERS" | "DOCTORATE" | "EXCHANGE" | "OTHER";
type StudentJourney = NewPersonalJourney | "INCOMING_STUDENT";

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

const interests = [
  "Housing",
  "Roommate",
  "Community",
  "Marketplace",
  "Internship",
  "Scholarship",
  "Student Guide",
] as const;

const interestEmoji: Record<string, string> = {
  Housing: "🏠",
  Roommate: "🧑🏾‍🤝‍🧑🏿",
  Community: "🌍",
  Marketplace: "🛍️",
  Internship: "💼",
  Scholarship: "🏅",
  "Student Guide": "🧭",
};

const steps = [
  {
    key: "personal_journey",
    title: "Which situation best describes you?",
    description:
      "Choose your current situation. You can update it later without creating a new account.",
    icon: "👋",
  },
  {
    key: "country",
    title: "Where are you from?",
    description:
      "Your personal country connects you with the right national community.",
    icon: "🌍",
  },
  {
    key: "context",
    title: "Add the context that matters",
    description:
      "Kondo only asks for information relevant to your current journey.",
    icon: "🧭",
  },
  {
    key: "plans",
    title: "Tell us a little more",
    description: "This helps Kondo prioritize useful guidance and tools.",
    icon: "📚",
  },
  {
    key: "interests",
    title: "What would be useful to you?",
    description:
      "Choose what matters now. Everything can be changed from Settings.",
    icon: "✨",
  },
] as const;

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
  const [step, setStep] = useState(
    Math.min(Math.max(initialValues.onboardingStep ?? 0, 0), steps.length - 1),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const stepStartedAt = useRef<number | null>(null);
  const initialJourney =
    initialValues.studentJourney === "INCOMING_STUDENT"
      ? "INCOMING_STUDENT"
      : initialValues.studentJourney &&
          NEW_PERSONAL_JOURNEYS.includes(
            initialValues.studentJourney as NewPersonalJourney,
          )
        ? initialValues.studentJourney
        : "";
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

  const canContinue =
    step === 0
      ? Boolean(form.gender && form.studentJourney)
      : step === 1
        ? Boolean(form.countryId)
        : step === 2
          ? contextStepComplete(form)
          : step === 3
            ? planStepComplete(form)
            : true;

  return (
    <div className="mx-auto grid min-h-[calc(100vh-96px)] max-w-5xl items-center gap-8 py-8 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside aria-label="Onboarding progress">
        <div className="flex gap-2 lg:flex-col">
          {steps.map((item, index) => (
            <div
              className={cn(
                "flex flex-1 items-center gap-3 rounded-2xl p-3 transition motion-reduce:transition-none",
                step === index && "bg-card shadow-sm",
              )}
              key={item.key}
            >
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black",
                  index < step
                    ? "bg-primary text-primary-foreground"
                    : step === index
                      ? "bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {index < step ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span className="hidden text-sm font-bold lg:block">
                {item.title}
              </span>
            </div>
          ))}
        </div>
      </aside>

      <section className="rounded-4xl border border-border bg-card p-6 text-card-foreground shadow-soft sm:p-10">
        <div className="flex items-center justify-between gap-4">
          <span aria-hidden="true" className="text-4xl">
            {steps[step].icon}
          </span>
          {completed ? (
            <Button asChild size="sm" variant="ghost">
              <Link href="/settings">Exit editing</Link>
            </Button>
          ) : null}
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-[-0.04em] text-kondo-ink dark:text-white">
          {steps[step].title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {steps[step].description}
        </p>

        <div className="mt-8 min-h-[300px]">
          {step === 0 ? <JourneyStep form={form} setForm={setForm} /> : null}
          {step === 1 ? (
            <SearchableSelect
              emptyMessage="No country matches your search."
              label="Country of origin"
              onSelect={(countryId) => setForm({ ...form, countryId })}
              options={countries}
              placeholder="Select your country"
              searchPlaceholder="Search countries…"
              selected={form.countryId}
            />
          ) : null}
          {step === 2 ? (
            <ContextStep
              availableUniversities={availableUniversities}
              cities={cities}
              form={form}
              setForm={setForm}
              targetUniversities={targetUniversities}
              universities={universities}
            />
          ) : null}
          {step === 3 ? <PlansStep form={form} setForm={setForm} /> : null}
          {step === 4 ? <InterestsStep form={form} setForm={setForm} /> : null}
        </div>

        {error ? (
          <p
            className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-7 flex items-center justify-between gap-3">
          <Button
            disabled={loading || step === 0}
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            type="button"
            variant="ghost"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step === steps.length - 1 ? (
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
          )}
        </div>
      </section>
    </div>
  );
}

function JourneyStep({
  form,
  setForm,
}: {
  form: OnboardingForm;
  setForm: FormSetter;
}) {
  return (
    <div className="grid gap-5">
      <fieldset>
        <legend className="mb-2 text-sm font-bold text-kondo-ink dark:text-white">
          Gender
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "MALE", label: "Man" },
            { value: "FEMALE", label: "Woman" },
          ].map((option) => (
            <button
              aria-pressed={form.gender === option.value}
              className={selectionClass(form.gender === option.value)}
              key={option.value}
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  gender: option.value,
                }))
              }
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3">
        {NEW_PERSONAL_JOURNEYS.map((journey) => {
          const item = PERSONAL_JOURNEY_PRESENTATION[journey];
          const selected = form.studentJourney === journey;
          return (
            <button
              aria-pressed={selected}
              className={cn(
                "flex items-center gap-4 rounded-3xl border p-4 text-left outline-none transition motion-reduce:transition-none focus-visible:ring-4 focus-visible:ring-kondo-green/20",
                selected
                  ? "border-kondo-green bg-kondo-mint text-kondo-forest shadow-sm dark:bg-emerald-400/10 dark:text-emerald-200"
                  : "border-border bg-background hover:border-kondo-green/50 hover:bg-muted/60",
              )}
              key={journey}
              onClick={() => {
                setForm((current) => ({
                  ...current,
                  studentJourney: journey,
                }));
                captureProductEvent(PRODUCT_EVENTS.PERSONAL_JOURNEY_SELECTED, {
                  journey,
                });
              }}
              type="button"
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-card text-2xl shadow-sm">
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-black">{item.label}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {item.description}
                </span>
              </span>
              {selected ? <Check className="h-5 w-5 shrink-0" /> : null}
            </button>
          );
        })}
        {form.studentJourney === "INCOMING_STUDENT" ? (
          <p className="rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
            Your legacy “Incoming student” status is preserved. Choose
            Prospective or Admitted only when you are ready to clarify it.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ContextStep({
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
      <div className="grid gap-5">
        <InputField
          label="Current city"
          onChange={(currentCityName) =>
            setForm((current) => ({ ...current, currentCityName }))
          }
          placeholder="Douala, Shanghai, Paris…"
          value={form.currentCityName}
        />
        <InputField
          label="Professional area"
          onChange={(professionalArea) =>
            setForm((current) => ({ ...current, professionalArea }))
          }
          placeholder="Education, technology, trade…"
          value={form.professionalArea}
        />
        <TextAreaField
          label="Your professional connection with China"
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
      <div className="grid gap-5">
        <fieldset>
          <legend className="mb-2 text-sm font-bold">University plans</legend>
          <div className="grid gap-2">
            {[
              ["NOT_CHOSEN", "I have not chosen a university yet"],
              ["CONSIDERING_SEVERAL", "I am considering several universities"],
              ["PREFERRED_SELECTED", "I already have preferred universities"],
            ].map(([value, label]) => (
              <button
                aria-pressed={form.universityPreferenceMode === value}
                className={selectionClass(
                  form.universityPreferenceMode === value,
                )}
                key={value}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    universityPreferenceMode: value,
                    targetUniversityIds:
                      value === "NOT_CHOSEN" ? [] : current.targetUniversityIds,
                  }))
                }
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <MultiOptionPicker
          label="Preferred Chinese cities (optional)"
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
          selected={form.targetCityIds}
        />
        {form.universityPreferenceMode !== "NOT_CHOSEN" ? (
          <MultiOptionPicker
            label="Preferred universities"
            onChange={(targetUniversityIds) =>
              setForm((current) => ({
                ...current,
                targetUniversityIds,
              }))
            }
            options={targetUniversities}
            selected={form.targetUniversityIds}
          />
        ) : null}
      </div>
    );
  }

  const optional = form.studentJourney === "ALUMNI";
  return (
    <div className="grid gap-5">
      <SearchableSelect
        clearLabel={optional ? "No former study city selected" : undefined}
        icon={<MapPin />}
        label={optional ? "Former study city (optional)" : "Study city"}
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
        clearLabel={optional ? "No former university selected" : undefined}
        disabled={!form.cityId}
        emptyMessage="No university is registered for this city."
        icon={<GraduationCap />}
        label={optional ? "Former university (optional)" : "University"}
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
        <InputField
          label="Campus (optional)"
          onChange={(campusName) =>
            setForm((current) => ({ ...current, campusName }))
          }
          placeholder="Main campus"
          value={form.campusName}
        />
      ) : null}
      {form.studentJourney === "ALUMNI" ? (
        <InputField
          inputMode="numeric"
          label="Graduation year (optional)"
          onChange={(graduationYear) =>
            setForm((current) => ({ ...current, graduationYear }))
          }
          placeholder="2024"
          value={form.graduationYear}
        />
      ) : null}
    </div>
  );
}

function PlansStep({
  form,
  setForm,
}: {
  form: OnboardingForm;
  setForm: FormSetter;
}) {
  if (form.studentJourney === "PROFESSIONAL") {
    return (
      <TextAreaField
        label="Current professional context (optional)"
        onChange={(currentProfessionalContext) =>
          setForm((current) => ({
            ...current,
            currentProfessionalContext,
          }))
        }
        placeholder="What are you building, offering or looking for?"
        value={form.currentProfessionalContext}
      />
    );
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <InputField
        label={
          form.studentJourney === "PROSPECTIVE_STUDENT"
            ? "Intended field or education goal"
            : "Program or study field"
        }
        onChange={(degree) => setForm((current) => ({ ...current, degree }))}
        placeholder="Computer Science"
        value={form.degree}
      />
      <label>
        <span className="mb-2 block text-sm font-bold">Study level</span>
        <select
          className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-kondo-green"
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              studyLevel: event.target.value as StudyLevel,
            }))
          }
          value={form.studyLevel}
        >
          <option value="">Select a level</option>
          <option value="LANGUAGE">Language program</option>
          <option value="BACHELORS">Bachelor’s</option>
          <option value="MASTERS">Master’s</option>
          <option value="DOCTORATE">Doctorate</option>
          <option value="EXCHANGE">Exchange</option>
          <option value="OTHER">Other</option>
        </select>
      </label>
      {form.studentJourney === "PROSPECTIVE_STUDENT" ? (
        <>
          <label>
            <span className="mb-2 block text-sm font-bold">
              Application stage (optional)
            </span>
            <select
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-kondo-green"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  applicationStage: event.target.value,
                }))
              }
              value={form.applicationStage}
            >
              <option value="EXPLORING">Exploring</option>
              <option value="SEARCHING_SCHOLARSHIPS">
                Searching for scholarships
              </option>
              <option value="PREPARING_APPLICATION">
                Preparing an application
              </option>
              <option value="APPLICATION_SUBMITTED">
                Application submitted
              </option>
              <option value="WAITING_FOR_DECISION">
                Waiting for a decision
              </option>
              <option value="ADMITTED">Admitted</option>
              <option value="PREPARING_ARRIVAL">Preparing to arrive</option>
            </select>
          </label>
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
        </>
      ) : null}
      {["ADMITTED_STUDENT", "CURRENT_STUDENT", "INCOMING_STUDENT"].includes(
        form.studentJourney,
      ) ? (
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
      ) : null}
      {form.studentJourney === "ADMITTED_STUDENT" ? (
        <div className="sm:col-span-2">
          <TextAreaField
            label="Arrival preparation context (optional)"
            onChange={(arrivalPreparationContext) =>
              setForm((current) => ({
                ...current,
                arrivalPreparationContext,
              }))
            }
            placeholder="Visa, housing, airport arrival, campus registration, or anything you are preparing now."
            value={form.arrivalPreparationContext}
          />
        </div>
      ) : null}
      {form.studentJourney === "ALUMNI" ? (
        <>
          <InputField
            label="Current city (optional)"
            onChange={(currentCityName) =>
              setForm((current) => ({ ...current, currentCityName }))
            }
            placeholder="Douala, Shanghai, Paris…"
            value={form.currentCityName}
          />
          <div className="sm:col-span-2">
            <TextAreaField
              label="Current professional context (optional)"
              onChange={(currentProfessionalContext) =>
                setForm((current) => ({
                  ...current,
                  currentProfessionalContext,
                }))
              }
              placeholder="Share what you do now or what kind of connections you are looking for."
              value={form.currentProfessionalContext}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function InterestsStep({
  form,
  setForm,
}: {
  form: OnboardingForm;
  setForm: FormSetter;
}) {
  return (
    <div className="grid gap-6">
      <div>
        <p className="mb-3 text-sm font-bold">Interests (optional)</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {interests.map((interest) => {
            const selected = form.interests.includes(interest);
            return (
              <button
                aria-pressed={selected}
                className={selectionClass(selected)}
                key={interest}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    interests: selected
                      ? current.interests.filter((item) => item !== interest)
                      : [...current.interests, interest],
                  }))
                }
                type="button"
              >
                <span className="mr-1">{interestEmoji[interest]}</span>{" "}
                {interest}
              </button>
            );
          })}
        </div>
      </div>
      <InputField
        label="Languages (comma separated)"
        onChange={(value) =>
          setForm((current) => ({
            ...current,
            languages: value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
              .slice(0, 8),
          }))
        }
        placeholder="English, French"
        value={form.languages.join(", ")}
      />
    </div>
  );
}

function MultiOptionPicker({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = options.filter((option) =>
    `${option.name} ${option.secondary ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold">{label}</legend>
      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        <label className="flex h-11 items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Search {label}</span>
          <input
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            value={query}
          />
        </label>
        <div className="max-h-48 overflow-y-auto p-2">
          {filtered.length ? (
            filtered.map((option) => {
              const checked = selected.includes(option.id);
              return (
                <button
                  aria-pressed={checked}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                    checked
                      ? "bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
                      : "hover:bg-muted",
                  )}
                  key={option.id}
                  onClick={() =>
                    onChange(
                      checked
                        ? selected.filter((id) => id !== option.id)
                        : [...selected, option.id],
                    )
                  }
                  type="button"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {option.name}
                    </span>
                    {option.secondary ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.secondary}
                      </span>
                    ) : null}
                  </span>
                  {checked ? <Check className="h-4 w-4" /> : null}
                </button>
              );
            })
          ) : (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No match found.
            </p>
          )}
        </div>
      </div>
      {selected.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {selected.length} selected
        </p>
      ) : null}
    </fieldset>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <input
        className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-kondo-green focus:ring-4 focus:ring-kondo-green/10"
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <input
        className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-kondo-green"
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <textarea
        className="min-h-28 w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-kondo-green focus:ring-4 focus:ring-kondo-green/10"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function selectionClass(selected: boolean) {
  return cn(
    "rounded-2xl border px-4 py-3 text-sm font-bold outline-none transition motion-reduce:transition-none focus-visible:ring-4 focus-visible:ring-kondo-green/20",
    selected
      ? "border-kondo-green bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
      : "border-border bg-background text-foreground hover:border-kondo-green/50 hover:bg-muted",
  );
}

function contextStepComplete(form: OnboardingForm) {
  if (form.studentJourney === "PROFESSIONAL") {
    return Boolean(
      form.currentCityName.trim() &&
      form.professionalArea.trim() &&
      form.chinaRelationship.trim(),
    );
  }
  if (form.studentJourney === "PROSPECTIVE_STUDENT") {
    return (
      form.universityPreferenceMode !== "PREFERRED_SELECTED" ||
      form.targetUniversityIds.length > 0
    );
  }
  if (form.studentJourney === "ALUMNI") return true;
  return Boolean(form.cityId && form.universityId);
}

function planStepComplete(form: OnboardingForm) {
  if (
    form.studentJourney === "PROFESSIONAL" ||
    form.studentJourney === "ALUMNI"
  ) {
    return true;
  }
  if (form.studentJourney === "PROSPECTIVE_STUDENT") {
    return Boolean(form.degree.trim() || form.studyLevel);
  }
  return Boolean(form.degree.trim() && form.studyLevel);
}
