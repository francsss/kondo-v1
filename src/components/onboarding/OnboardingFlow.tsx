"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GraduationCap,
  MapPin,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string; secondary?: string };
type CityOption = Option & { countryId: string };
type UniversityOption = Option & { cityId: string; countryId: string };
type StudyLevel =
  "LANGUAGE" | "BACHELORS" | "MASTERS" | "DOCTORATE" | "EXCHANGE" | "OTHER";
type StudentJourney = "CURRENT_STUDENT" | "INCOMING_STUDENT" | "ALUMNI";
type InitialValues = {
  studentJourney: StudentJourney | null;
  countryId: string | null;
  cityId: string | null;
  universityId: string | null;
  degree: string | null;
  studyLevel: StudyLevel | null;
  arrivalDate: string | null;
  languages: string[];
  interests: string[];
};
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
const onboardingStepKeys = [
  "student_journey",
  "country",
  "study_location",
  "studies",
  "interests",
] as const;

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
  const initialCityId = cities.some((city) => city.id === initialValues.cityId)
    ? (initialValues.cityId ?? "")
    : "";
  const initialUniversities = universities.filter(
    (university) => university.cityId === initialCityId,
  );
  const initialUniversityId = initialUniversities.some(
    (university) => university.id === initialValues.universityId,
  )
    ? (initialValues.universityId ?? "")
    : "";
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const stepStartedAtRef = useRef(0);
  const [form, setForm] = useState({
    studentJourney: initialValues.studentJourney ?? "",
    countryId: countries.some(
      (country) => country.id === initialValues.countryId,
    )
      ? (initialValues.countryId ?? "")
      : "",
    cityId: initialCityId,
    universityId: initialUniversityId,
    degree: initialValues.degree ?? "",
    studyLevel: initialValues.studyLevel ?? "MASTERS",
    arrivalDate:
      initialValues.arrivalDate?.slice(0, 10) ??
      new Date().toISOString().slice(0, 10),
    languages: initialValues.languages.length
      ? initialValues.languages
      : ["English"],
    interests: initialValues.interests,
  });
  const availableUniversities = useMemo(
    () =>
      universities.filter((university) => university.cityId === form.cityId),
    [form.cityId, universities],
  );

  useEffect(() => {
    if (!completed) {
      captureProductEvent(PRODUCT_EVENTS.ONBOARDING_STARTED);
    }
  }, [completed]);

  useEffect(() => {
    stepStartedAtRef.current = Date.now();
    captureProductEvent(PRODUCT_EVENTS.ONBOARDING_STEP_REACHED, {
      step: onboardingStepKeys[step],
      step_number: step + 1,
    });
  }, [step]);

  const steps = [
    {
      title: "Which best describes you?",
      description:
        "Choose where you are in your journey so Kondo can prioritize the most useful experiences.",
      icon: "👋",
    },
    {
      title: "Where are you from?",
      description: "This helps us connect you with your country community.",
      icon: "🌍",
    },
    {
      title: "Where are you studying?",
      description: "We’ll surface the people and answers closest to you.",
      icon: "🎓",
    },
    {
      title: "Tell us about your studies",
      description: "Just enough to make your home feed useful.",
      icon: "📚",
    },
    {
      title: "What are you looking for?",
      description: "Choose everything that would make student life easier.",
      icon: "✨",
    },
  ];

  function toggleInterest(value: string) {
    setForm((current) => ({
      ...current,
      interests: current.interests.includes(value)
        ? current.interests.filter((item) => item !== value)
        : [...current.interests, value],
    }));
  }

  async function save(method: "PATCH" | "PUT") {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/onboarding", {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        captureProductEvent(PRODUCT_EVENTS.ONBOARDING_VALIDATION_ERROR, {
          step: onboardingStepKeys[step],
          step_number: step + 1,
          status: response.status,
          error_type: "invalid_step",
        });
        setError(data.error ?? "Please check your answers.");
        return false;
      }
      return true;
    } catch {
      captureProductEvent(PRODUCT_EVENTS.ONBOARDING_VALIDATION_ERROR, {
        step: onboardingStepKeys[step],
        step_number: step + 1,
        error_type: "network_error",
      });
      setError("Kondo could not save your profile. Please try again.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function continueToNextStep() {
    if (await save("PATCH")) {
      captureProductEvent(PRODUCT_EVENTS.ONBOARDING_STEP_COMPLETED, {
        step: onboardingStepKeys[step],
        step_number: step + 1,
        duration_seconds: Math.round(
          (Date.now() - stepStartedAtRef.current) / 1_000,
        ),
      });
      setStep((value) => value + 1);
    }
  }

  async function finish() {
    if (!(await save("PUT"))) return;
    captureProductEvent(PRODUCT_EVENTS.ONBOARDING_STEP_COMPLETED, {
      step: onboardingStepKeys[step],
      step_number: step + 1,
      duration_seconds: Math.round(
        (Date.now() - stepStartedAtRef.current) / 1_000,
      ),
    });
    if (!completed) {
      captureProductEvent(PRODUCT_EVENTS.ONBOARDING_COMPLETED);
      window.sessionStorage.setItem("kondo:onboarding-completed", "1");
    }
    router.push("/home");
    router.refresh();
  }

  const canContinue =
    step === 0
      ? Boolean(form.studentJourney)
      : step === 1
        ? Boolean(form.countryId)
        : step === 2
          ? Boolean(form.cityId && form.universityId)
          : step === 3
            ? Boolean(form.degree && form.arrivalDate && form.languages.length)
            : form.interests.length > 0;

  return (
    <div className="mx-auto grid min-h-[calc(100vh-96px)] max-w-5xl items-center gap-10 py-10 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside>
        <div className="flex gap-2 lg:flex-col">
          {steps.map((item, index) => (
            <div
              className={cn(
                "flex flex-1 items-center gap-3 rounded-2xl p-3 transition",
                step === index && "bg-white shadow-sm dark:bg-white/5",
              )}
              key={item.title}
            >
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black",
                  index < step
                    ? "bg-primary text-primary-foreground"
                    : step === index
                      ? "bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300"
                      : "bg-slate-100 text-muted-foreground dark:bg-white/5",
                )}
              >
                {index < step ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span className="hidden lg:block">
                <span
                  className={cn(
                    "block text-sm font-bold",
                    step === index
                      ? "text-kondo-ink dark:text-white"
                      : "text-muted-foreground",
                  )}
                >
                  {item.title}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  Step {index + 1} of {steps.length}
                </span>
              </span>
            </div>
          ))}
        </div>
      </aside>
      <section className="rounded-4xl border border-border bg-card p-6 text-card-foreground shadow-soft sm:p-10">
        <div className="flex items-center justify-between gap-4">
          <span className="text-4xl">{steps[step].icon}</span>
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
        <div className="mt-8 min-h-[260px]">
          {step === 0 ? (
            <div className="grid gap-3">
              {[
                {
                  value: "CURRENT_STUDENT",
                  icon: "🎓",
                  title: "Current Student",
                  description:
                    "Campus life, communities, student tools and opportunities.",
                },
                {
                  value: "INCOMING_STUDENT",
                  icon: "✈️",
                  title: "Incoming Student",
                  description:
                    "Visa guidance, housing, preparation and arrival information.",
                },
                {
                  value: "ALUMNI",
                  icon: "🎓",
                  title: "Alumnus / Alumna",
                  description:
                    "Networking, mentoring and professional opportunities.",
                },
              ].map((journey) => {
                const selected = form.studentJourney === journey.value;
                return (
                  <button
                    aria-pressed={selected}
                    className={cn(
                      "flex items-center gap-4 rounded-3xl border p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "border-kondo-green bg-kondo-mint text-kondo-forest shadow-sm dark:bg-emerald-400/10 dark:text-emerald-200"
                        : "border-border bg-background hover:border-emerald-300 hover:bg-muted/60",
                    )}
                    key={journey.value}
                    onClick={() =>
                      setForm({
                        ...form,
                        studentJourney: journey.value as StudentJourney,
                      })
                    }
                    type="button"
                  >
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-card text-2xl shadow-sm">
                      {journey.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-black">{journey.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {journey.description}
                      </span>
                    </span>
                    {selected ? <Check className="h-5 w-5 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          {step === 1 ? (
            <SearchableSelect
              emptyMessage="No African country matches your search."
              label="Country of origin"
              options={countries}
              placeholder="Select your country"
              searchPlaceholder="Search African countries…"
              selected={form.countryId}
              onSelect={(countryId) => setForm({ ...form, countryId })}
            />
          ) : null}
          {step === 2 ? (
            <div className="grid gap-5">
              <SearchableSelect
                icon={<MapPin />}
                label="City in China"
                options={cities}
                placeholder="Select your city"
                searchPlaceholder="Search cities or provinces…"
                selected={form.cityId}
                onSelect={(cityId) => {
                  const nextUniversities = universities.filter(
                    (university) => university.cityId === cityId,
                  );
                  setForm({
                    ...form,
                    cityId,
                    universityId: nextUniversities.some(
                      (university) => university.id === form.universityId,
                    )
                      ? form.universityId
                      : "",
                  });
                }}
              />
              <SearchableSelect
                disabled={!form.cityId}
                emptyMessage="No university is registered for this city."
                icon={<GraduationCap />}
                label="University"
                options={availableUniversities}
                placeholder={
                  form.cityId ? "Select your university" : "Select a city first"
                }
                searchPlaceholder="Search universities…"
                selected={form.universityId}
                onSelect={(universityId) => setForm({ ...form, universityId })}
              />
              {form.cityId ? (
                <p className="-mt-2 text-xs leading-5 text-muted-foreground">
                  Only universities located in the selected city are shown.
                </p>
              ) : null}
            </div>
          ) : null}
          {step === 3 ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <InputField
                label="Degree or program"
                value={form.degree}
                onChange={(degree) => setForm({ ...form, degree })}
                placeholder="Computer Science"
              />
              <label>
                <span className="mb-2 block text-sm font-bold text-kondo-ink dark:text-white">
                  Study level
                </span>
                <select
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-transparent px-4 text-sm dark:border-white/10"
                  value={form.studyLevel}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      studyLevel: event.target.value as StudyLevel,
                    })
                  }
                >
                  {[
                    "LANGUAGE",
                    "BACHELORS",
                    "MASTERS",
                    "DOCTORATE",
                    "EXCHANGE",
                    "OTHER",
                  ].map((value) => (
                    <option key={value} value={value}>
                      {value[0] + value.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-2 block text-sm font-bold text-kondo-ink dark:text-white">
                  Arrival date
                </span>
                <input
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-transparent px-4 text-sm dark:border-white/10"
                  type="date"
                  value={form.arrivalDate}
                  onChange={(event) =>
                    setForm({ ...form, arrivalDate: event.target.value })
                  }
                />
              </label>
              <InputField
                label="Languages"
                value={form.languages.join(", ")}
                onChange={(value) =>
                  setForm({
                    ...form,
                    languages: value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="English, French"
              />
            </div>
          ) : null}
          {step === 4 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {interests.map((interest) => (
                <button
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-4 text-left text-sm font-bold transition",
                    form.interests.includes(interest)
                      ? "border-kondo-green bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300"
                      : "border-slate-200 text-muted-foreground hover:border-emerald-200 dark:border-white/10 dark:text-muted-foreground",
                  )}
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  type="button"
                >
                  <span className="text-xl">{interestEmoji[interest]}</span>
                  <span className="flex-1">{interest}</span>
                  {form.interests.includes(interest) ? (
                    <Check className="h-4 w-4" />
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {error ? (
          <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300">
            {error}
          </p>
        ) : null}
        <div className="flex items-center justify-between">
          <Button
            disabled={step === 0}
            onClick={() => setStep((value) => value - 1)}
            variant="ghost"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < steps.length - 1 ? (
            <Button
              disabled={!canContinue || loading}
              onClick={continueToNextStep}
            >
              {loading ? "Saving…" : "Continue"}{" "}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button disabled={!canContinue || loading} onClick={finish}>
              {loading ? (
                "Personalizing…"
              ) : (
                <>
                  {completed ? "Save profile" : "Build my Kondo"}{" "}
                  <Sparkles className="h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold text-kondo-ink dark:text-white">
        {label}
      </span>
      <input
        className="h-12 w-full rounded-2xl border border-slate-200 bg-transparent px-4 text-sm outline-none focus:border-kondo-green dark:border-white/10"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}
