"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  Loader2,
  Save,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FocusedFormShell } from "@/components/ui/FocusedFormShell";
import { UnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { FormResult, type FormResultState } from "@/components/ui/FormResult";
import { KONDO_CONTROL_CLASS } from "@/components/ui/Form";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { uploadMediaFile } from "@/lib/client-media";

type ReferenceOption = { id: string; name: string };

type EditorState = {
  type: string;
  title: string;
  shortDescription: string;
  description: string;
  countryId: string;
  cityId: string;
  universityId: string;
  locationLabel: string;
  workMode: string;
  degreeLevels: string;
  fieldsOfStudy: string;
  eligibilityCriteria: string;
  languages: string;
  fundingType: string;
  tuitionCoverage: string;
  accommodationCoverage: string;
  monthlyStipend: string;
  stipendCurrency: string;
  employmentType: string;
  experienceLevel: string;
  weeklyHours: string;
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  salaryPeriod: string;
  paid: string;
  technicalSkills: string;
  softSkills: string;
  benefits: string;
  requirements: string[];
  questions: string;
  applicationOpenAt: string;
  applicationDeadline: string;
  rollingApplications: boolean;
  expectedDecisionDate: string;
  opportunityStartDate: string;
  opportunityEndDate: string;
  timezone: string;
  applicationMethod: string;
  externalApplicationUrl: string;
  applicationEmail: string;
  officialSourceUrl: string;
  accuracyConfirmed: boolean;
};

type InitialOpportunity = Partial<EditorState> & {
  id: string;
  lifecycle: string;
  applicationCount: number;
  coverMediaId?: string | null;
};

/*
 * Three steps, not six.
 *
 * Publishing an opportunity was six screens — Basics, Location, Eligibility,
 * Benefits, Application, Review — several of which held two or three fields.
 * That is more Continue presses than thinking. Grouped by the question being
 * answered: what is it and where, who it is for and what they get, and how to
 * apply.
 */
const STEPS = ["What & where", "Who & what they get", "How to apply"] as const;

const TYPES = [
  ["SCHOLARSHIP", "Scholarship"],
  ["INTERNSHIP", "Internship"],
  ["FULL_TIME_JOB", "Job"],
  ["RESEARCH_OPPORTUNITY", "Research"],
  ["VOLUNTEERING", "Volunteering"],
  ["EXCHANGE_PROGRAM", "Program"],
] as const;

const DOCUMENTS = [
  "CV",
  "TRANSCRIPT",
  "ENROLLMENT_CERTIFICATE",
  "RECOMMENDATION_LETTER",
  "MOTIVATION_LETTER",
  "LANGUAGE_CERTIFICATE",
  "PORTFOLIO",
  "RESEARCH_PROPOSAL",
  "PASSPORT_COPY",
] as const;

const EMPTY: EditorState = {
  type: "SCHOLARSHIP",
  title: "",
  shortDescription: "",
  description: "",
  countryId: "",
  cityId: "",
  universityId: "",
  locationLabel: "",
  workMode: "UNSPECIFIED",
  degreeLevels: "",
  fieldsOfStudy: "",
  eligibilityCriteria: "",
  languages: "",
  fundingType: "FULLY_FUNDED",
  tuitionCoverage: "",
  accommodationCoverage: "",
  monthlyStipend: "",
  stipendCurrency: "CNY",
  employmentType: "INTERNSHIP",
  experienceLevel: "UNSPECIFIED",
  weeklyHours: "",
  salaryMin: "",
  salaryMax: "",
  salaryCurrency: "CNY",
  salaryPeriod: "MONTH",
  paid: "UNSPECIFIED",
  technicalSkills: "",
  softSkills: "",
  benefits: "",
  requirements: [],
  questions: "",
  applicationOpenAt: "",
  applicationDeadline: "",
  rollingApplications: false,
  expectedDecisionDate: "",
  opportunityStartDate: "",
  opportunityEndDate: "",
  timezone: "Asia/Shanghai",
  applicationMethod: "KONDO_APPLICATION",
  externalApplicationUrl: "",
  applicationEmail: "",
  officialSourceUrl: "",
  accuracyConfirmed: false,
};

/*
 * The same field the rest of Kondo now uses.
 *
 * These were a local variation with a 4px focus ring — a heavy green halo that
 * did not match anything else and read as an error state. The shared shell
 * keeps the border at 1px in every state and draws focus inset, so nothing
 * moves and the treatment is identical across every Kondo form.
 */
const fieldClass = KONDO_CONTROL_CLASS;
const textareaClass = `${fieldClass} min-h-28 py-3 leading-7`;

function lines(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function csv(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function minor(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0
    ? Math.round(amount * 100)
    : null;
}

function asDate(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function OpportunityEditor({
  organization,
  countries,
  cities,
  universities,
  initial,
}: {
  organization: { id: string; slug: string; name: string };
  countries: ReferenceOption[];
  cities: (ReferenceOption & { countryId: string })[];
  universities: (ReferenceOption & { cityId: string | null })[];
  initial?: InitialOpportunity | null;
}) {
  const router = useRouter();
  const pendingRef = useRef(false);
  const draftKey = `kondo:opportunity-draft:${organization.id}:${initial?.id ?? "new"}`;
  const [step, setStep] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Set once the flow finishes; the outcome replaces the form.
  const [result, setResult] = useState<FormResultState | null>(null);
  const [state, setState] = useState<EditorState>({ ...EMPTY, ...initial });
  const [cover, setCover] = useState<File | null>(null);
  const [coverAlt, setCoverAlt] = useState(initial?.title ?? "");
  // null while idle; 0-100 while an image is actually being sent.
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [restored, setRestored] = useState(false);
  /*
   * Dirty means "differs from what was loaded", so an untouched form never
   * nags, and a finished one is never dirty because the work is saved by then.
   */
  const pristine = useMemo(
    () => JSON.stringify({ ...EMPTY, ...initial }),
    [initial],
  );
  const isDirty = !result && JSON.stringify(state) !== pristine;
  const isScholarship = state.type === "SCHOLARSHIP";
  const isJob = [
    "INTERNSHIP",
    "GRADUATE_INTERNSHIP",
    "PART_TIME_JOB",
    "FULL_TIME_JOB",
    "CAMPUS_JOB",
    "VOLUNTEERING",
    "RESEARCH_OPPORTUNITY",
  ].includes(state.type);
  const structureLocked = Boolean(initial?.applicationCount);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      if (!initial) {
        try {
          const saved = window.localStorage.getItem(draftKey);
          if (saved)
            setState({ ...EMPTY, ...(JSON.parse(saved) as EditorState) });
        } catch {
          // Local draft recovery is best effort; server validation is authoritative.
        }
      }
      setRestored(true);
    }, 0);
    return () => window.clearTimeout(restore);
  }, [draftKey, initial]);

  useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(state));
    } catch {
      // The editor remains usable when private browsing disables storage.
    }
  }, [draftKey, restored, state]);

  const availableCities = useMemo(
    () =>
      state.countryId
        ? cities.filter((city) => city.countryId === state.countryId)
        : cities,
    [cities, state.countryId],
  );
  const availableUniversities = useMemo(
    () =>
      state.cityId
        ? universities.filter(
            (university) =>
              !university.cityId || university.cityId === state.cityId,
          )
        : universities,
    [state.cityId, universities],
  );

  function update<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setFieldErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
    setState((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function payload() {
    const eligibilityRules = lines(state.eligibilityCriteria).map(
      (label, index) => ({
        ruleType: "CUSTOM",
        operator: "CUSTOM",
        structuredValue: { declaredCriterion: label },
        required: true,
        publicLabel: label,
        sortOrder: index,
      }),
    );
    const benefits = lines(state.benefits).map((entry, index) => {
      const [
        type = "OTHER",
        description = entry,
        confidence = "NOT_SPECIFIED",
      ] = entry.split("|").map((part) => part.trim());
      return {
        type,
        description,
        confidence,
        sortOrder: index,
      };
    });
    const questions = lines(state.questions).map((label, index) => ({
      type: "LONG_TEXT",
      label,
      required: true,
      sortOrder: index,
    }));
    const languageRequirements = lines(state.languages).map((entry) => {
      const [language, level = "INTERMEDIATE", certificateType] = entry
        .split("|")
        .map((part) => part.trim());
      return {
        language,
        level,
        certificateType: certificateType || null,
        required: true,
      };
    });
    return {
      draft: {
        type: state.type,
        title: state.title,
        shortDescription: state.shortDescription,
        description: state.description,
        countryId: state.countryId || null,
        cityId: state.cityId || null,
        universityId: state.universityId || null,
        locationLabel: state.locationLabel || null,
        workMode: state.workMode,
        degreeLevels: csv(state.degreeLevels),
        fieldsOfStudy: csv(state.fieldsOfStudy),
        applicationOpenAt: asDate(state.applicationOpenAt),
        applicationDeadline: asDate(state.applicationDeadline),
        rollingApplications: state.rollingApplications,
        expectedDecisionDate: state.expectedDecisionDate || null,
        opportunityStartDate: state.opportunityStartDate || null,
        opportunityEndDate: state.opportunityEndDate || null,
        timezone: state.timezone,
        applicationMethod: state.applicationMethod,
        externalApplicationUrl: state.externalApplicationUrl || null,
        applicationEmail: state.applicationEmail || null,
        officialSourceUrl: state.officialSourceUrl || null,
      },
      scholarship: isScholarship
        ? {
            fundingType: state.fundingType,
            tuitionCoverage: state.tuitionCoverage || null,
            accommodationCoverage: state.accommodationCoverage || null,
            monthlyStipendMinor: minor(state.monthlyStipend),
            stipendCurrency: state.monthlyStipend
              ? state.stipendCurrency.toUpperCase()
              : null,
            nominationRequired:
              state.applicationMethod === "NOMINATION_REQUIRED",
            targetPrograms: [],
          }
        : null,
      job: isJob
        ? {
            employmentType: state.employmentType,
            experienceLevel: state.experienceLevel,
            weeklyHours: state.weeklyHours ? Number(state.weeklyHours) : null,
            salaryMinMinor: minor(state.salaryMin),
            salaryMaxMinor: minor(state.salaryMax),
            salaryCurrency:
              state.salaryMin || state.salaryMax
                ? state.salaryCurrency.toUpperCase()
                : null,
            salaryPeriod:
              state.salaryMin || state.salaryMax ? state.salaryPeriod : null,
            salaryNegotiable: false,
            paid: state.paid === "UNSPECIFIED" ? null : state.paid === "PAID",
            technicalSkills: csv(state.technicalSkills),
            softSkills: csv(state.softSkills),
          }
        : null,
      eligibilityRules,
      benefits,
      languageRequirements,
      ...(structureLocked
        ? {}
        : {
            requirements: state.requirements.map((documentType, index) => ({
              documentType,
              required: true,
              sortOrder: index,
            })),
            questions,
          }),
    };
  }

  /*
   * Checked when the person tries to leave a step, never on arrival, and the
   * first offending field is focused so nobody hunts for it. Same behaviour as
   * the catalog forms — this editor previously had none.
   */
  function validateStep(index: number) {
    const next: Record<string, string> = {};
    if (index === 0) {
      /*
       * These are the server's own minimums, applied where the field is —
       * not returned as a schema error after the last step, naming a field
       * the owner can no longer see. Kept in step with
       * `opportunityInputSchema` in src/features/opportunities/schemas.
       */
      if (state.title.trim().length < 6)
        next.title = "Enter a title of at least 6 characters.";
      if (state.shortDescription.trim().length < 20)
        next.shortDescription =
          "Add a summary of at least 20 characters — this is the card text.";
      if (state.description.trim().length < 50)
        next.description =
          "Describe the opportunity in at least 50 characters.";
    }
    if (index === 2) {
      if (
        state.applicationMethod === "EXTERNAL_URL" &&
        !state.externalApplicationUrl.trim()
      )
        next.externalApplicationUrl = "Add the link applicants should open.";
      if (state.applicationMethod === "EMAIL" && !state.applicationEmail.trim())
        next.applicationEmail = "Add the address applications should go to.";
      if (
        state.applicationOpenAt &&
        state.applicationDeadline &&
        state.applicationDeadline < state.applicationOpenAt
      )
        next.applicationDeadline = "The deadline is before the opening date.";
    }
    setFieldErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      const node = document.querySelector<HTMLElement>(
        `[data-field="${first}"]`,
      );
      node?.scrollIntoView({ block: "center" });
      node?.focus({ preventScroll: true });
    }
    return !first;
  }

  async function save(submitForReview: boolean) {
    if (submitForReview) {
      for (const index of [0, 2]) {
        if (!validateStep(index)) {
          setStep(index);
          return;
        }
      }
    }
    if (pendingRef.current) return;
    if (submitForReview && !state.accuracyConfirmed) {
      setError("Confirm that the published information is accurate.");
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setError("");
    setStatus(initial ? "Saving changes…" : "Creating draft…");
    try {
      const endpoint = initial
        ? `/api/organizations/${organization.id}/opportunities/${initial.id}`
        : `/api/organizations/${organization.id}/opportunities`;
      const response = await fetch(endpoint, {
        method: initial ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const saved = (await response.json().catch(() => null)) as {
        id?: string;
        error?: string;
      } | null;
      if (!response.ok || !saved?.id) {
        throw new Error(saved?.error ?? "The opportunity could not be saved.");
      }
      if (cover) {
        setStatus("Uploading cover…");
        setUploadProgress(0);
        const mediaId = await uploadMediaFile(cover, {
          onProgress: setUploadProgress,
          purpose: "OPPORTUNITY_COVER_IMAGE",
          altText: coverAlt.trim() || state.title,
        });
        const mediaResponse = await fetch(
          `/api/organizations/${organization.id}/opportunities/${saved.id}/media`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mediaId,
              altText: coverAlt.trim() || state.title,
            }),
          },
        );
        if (!mediaResponse.ok) {
          const mediaPayload = await mediaResponse.json().catch(() => null);
          throw new Error(
            mediaPayload?.error ?? "The cover could not be attached.",
          );
        }
      }
      if (submitForReview) {
        setStatus("Submitting for review…");
        const transition = await fetch(
          `/api/organizations/${organization.id}/opportunities/${saved.id}/transition`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "SUBMIT" }),
          },
        );
        const transitionPayload = await transition.json().catch(() => null);
        if (!transition.ok) {
          throw new Error(
            transitionPayload?.error ??
              "The opportunity could not be submitted.",
          );
        }
      }
      window.localStorage.removeItem(draftKey);
      setResult({
        // Submitting produces a record awaiting review, not a public one.
        kind: submitForReview ? "review" : "draft",
        noun: "Opportunity",
        title: state.title,
        backHref: `/organizations/${organization.slug}/opportunities`,
        backLabel: "Back to opportunities",
      });
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The opportunity could not be saved.",
      );
      setStatus("");
    } finally {
      pendingRef.current = false;
      setPending(false);
      setUploadProgress(null);
    }
  }

  function chooseCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG or WebP cover image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("The cover image must be 8 MB or smaller.");
      return;
    }
    setCover(file);
    if (!coverAlt) setCoverAlt(state.title);
  }

  if (result) {
    return (
      <FocusedFormShell
        backHref={`/organizations/${organization.slug}/opportunities`}
        context={organization.name}
        title={initial ? "Edit opportunity" : "New opportunity"}
      >
        <FormResult state={result} />
      </FocusedFormShell>
    );
  }

  return (
    /*
     * The same focused environment the catalog forms use: while this is open
     * the workspace bottom bar stands down so it cannot sit over the actions,
     * and the header keeps the organization and the task in view.
     */
    <FocusedFormShell
      backHref={`/organizations/${organization.slug}/opportunities`}
      context={organization.name}
      step={`Step ${step + 1} of ${STEPS.length}`}
      title={initial ? "Edit opportunity" : "New opportunity"}
    >
      <UnsavedChangesGuard isDirty={isDirty} />
      <ol className="mt-7 grid grid-cols-3 gap-2" aria-label="Progress">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              aria-current={index === step ? "step" : undefined}
              className={`w-full rounded-xl px-2 py-2 text-[11px] font-bold transition ${
                index === step
                  ? "bg-kondo-green text-white"
                  : index < step
                    ? "bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground"
              }`}
              onClick={() => setStep(index)}
              type="button"
            >
              {index < step ? <Check className="mx-auto h-3.5 w-3.5" /> : label}
            </button>
          </li>
        ))}
      </ol>

      <section className="mt-5 rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-7">
        {step === 0 ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-black">
                Type and essential information
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose the closest type. You can keep this as a private draft.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {TYPES.map(([value, label]) => (
                <button
                  className={`rounded-2xl border p-3 text-left text-sm font-bold transition ${
                    state.type === value
                      ? "border-kondo-green bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300"
                      : "border-border hover:border-kondo-green/40"
                  }`}
                  key={value}
                  onClick={() => update("type", value)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="block text-sm font-bold">
              Title
              <input
                className={`${fieldClass} mt-2`}
                data-field="title"
                maxLength={180}
                onChange={(event) => update("title", event.target.value)}
                value={state.title}
              />
              {fieldErrors.title ? (
                <span
                  className="mt-1.5 block text-xs font-bold text-destructive"
                  role="alert"
                >
                  {fieldErrors.title}
                </span>
              ) : null}
            </label>
            <label className="block text-sm font-bold">
              Short summary
              <textarea
                className={`${textareaClass} mt-2 min-h-24`}
                data-field="shortDescription"
                maxLength={400}
                onChange={(event) =>
                  update("shortDescription", event.target.value)
                }
                value={state.shortDescription}
              />
              {fieldErrors.shortDescription ? (
                <span
                  className="mt-1.5 block text-xs font-bold text-destructive"
                  role="alert"
                >
                  {fieldErrors.shortDescription}
                </span>
              ) : null}
              <span className="mt-1 block text-right text-xs font-normal text-muted-foreground">
                {state.shortDescription.length}/400
              </span>
            </label>
            <label className="block text-sm font-bold">
              Detailed description
              <textarea
                className={`${textareaClass} mt-2 min-h-48`}
                data-field="description"
                maxLength={20_000}
                onChange={(event) => update("description", event.target.value)}
                value={state.description}
              />
              {fieldErrors.description ? (
                <span
                  className="mt-1.5 block text-xs font-bold text-destructive"
                  role="alert"
                >
                  {fieldErrors.description}
                </span>
              ) : null}
            </label>
          </div>
        ) : null}

        {step === 0 ? (
          <div className="space-y-5">
            <h2 className="text-lg font-black">Location and audience</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {/*
               * Every ISO country now reaches this list, and the city list is
               * long too. Type-to-filter beats scrolling a native select of
               * 242 options; the short lists nearby stay plain selects.
               */}
              <SearchableSelect
                clearLabel="Not specified"
                label="Country"
                onSelect={(id) => update("countryId", id)}
                options={countries.map((item) => ({
                  id: item.id,
                  name: item.name,
                }))}
                placeholder="Not specified"
                searchPlaceholder="Search countries"
                selected={state.countryId}
              />
              <SearchableSelect
                clearLabel="Not specified"
                label="City"
                onSelect={(id) => update("cityId", id)}
                options={availableCities.map((item) => ({
                  id: item.id,
                  name: item.name,
                }))}
                placeholder="Not specified"
                searchPlaceholder="Search cities"
                selected={state.cityId}
              />
              <label className="text-sm font-bold">
                University
                <select
                  className={`${fieldClass} mt-2`}
                  onChange={(event) =>
                    update("universityId", event.target.value)
                  }
                  value={state.universityId}
                >
                  <option value="">Not specified</option>
                  {availableUniversities.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold">
                Format
                <select
                  className={`${fieldClass} mt-2`}
                  onChange={(event) => update("workMode", event.target.value)}
                  value={state.workMode}
                >
                  <option value="UNSPECIFIED">Not specified</option>
                  <option value="ON_SITE">On site</option>
                  <option value="REMOTE">Remote</option>
                  <option value="HYBRID">Hybrid</option>
                  <option value="CAMPUS">Campus</option>
                </select>
              </label>
            </div>
            <label className="block text-sm font-bold">
              Location label
              <input
                className={`${fieldClass} mt-2`}
                onChange={(event) =>
                  update("locationLabel", event.target.value)
                }
                placeholder="e.g. Hangzhou, Zhejiang"
                value={state.locationLabel}
              />
            </label>
            <label className="block text-sm font-bold">
              Degree levels, comma separated
              <input
                className={`${fieldClass} mt-2`}
                onChange={(event) => update("degreeLevels", event.target.value)}
                placeholder="BACHELORS, MASTERS"
                value={state.degreeLevels}
              />
            </label>
            <label className="block text-sm font-bold">
              Fields of study, comma separated
              <input
                className={`${fieldClass} mt-2`}
                onChange={(event) =>
                  update("fieldsOfStudy", event.target.value)
                }
                placeholder="Computer Science, Engineering"
                value={state.fieldsOfStudy}
              />
            </label>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-black">Eligibility</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Use one clear, verifiable criterion per line. Kondo guidance
                remains advisory.
              </p>
            </div>
            <label className="block text-sm font-bold">
              Public eligibility criteria
              <textarea
                className={`${textareaClass} mt-2 min-h-44`}
                onChange={(event) =>
                  update("eligibilityCriteria", event.target.value)
                }
                placeholder={
                  "Currently enrolled in a bachelor’s program\nMinimum GPA of 3.0/4.0\nGraduating in 2027 or later"
                }
                value={state.eligibilityCriteria}
              />
            </label>
            <label className="block text-sm font-bold">
              Language requirements, one per line
              <textarea
                className={`${textareaClass} mt-2`}
                onChange={(event) => update("languages", event.target.value)}
                placeholder={
                  "English | ADVANCED | IELTS\nChinese | INTERMEDIATE | HSK"
                }
                value={state.languages}
              />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Format: Language | Level | Optional certificate
              </span>
            </label>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-5">
            <h2 className="text-lg font-black">Benefits and requirements</h2>
            {isScholarship ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold">
                  Funding type
                  <select
                    className={`${fieldClass} mt-2`}
                    onChange={(event) =>
                      update("fundingType", event.target.value)
                    }
                    value={state.fundingType}
                  >
                    <option value="FULLY_FUNDED">Fully funded</option>
                    <option value="PARTIALLY_FUNDED">Partially funded</option>
                    <option value="TUITION_ONLY">Tuition only</option>
                    <option value="STIPEND_ONLY">Stipend only</option>
                    <option value="FEE_WAIVER">Fee waiver</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label className="text-sm font-bold">
                  Monthly stipend
                  <input
                    className={`${fieldClass} mt-2`}
                    inputMode="decimal"
                    onChange={(event) =>
                      update("monthlyStipend", event.target.value)
                    }
                    placeholder="Leave empty when not confirmed"
                    value={state.monthlyStipend}
                  />
                </label>
                <label className="text-sm font-bold">
                  Tuition coverage
                  <input
                    className={`${fieldClass} mt-2`}
                    onChange={(event) =>
                      update("tuitionCoverage", event.target.value)
                    }
                    value={state.tuitionCoverage}
                  />
                </label>
                <label className="text-sm font-bold">
                  Accommodation coverage
                  <input
                    className={`${fieldClass} mt-2`}
                    onChange={(event) =>
                      update("accommodationCoverage", event.target.value)
                    }
                    value={state.accommodationCoverage}
                  />
                </label>
              </div>
            ) : null}
            {isJob ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold">
                  Employment type
                  <select
                    className={`${fieldClass} mt-2`}
                    onChange={(event) =>
                      update("employmentType", event.target.value)
                    }
                    value={state.employmentType}
                  >
                    <option value="INTERNSHIP">Internship</option>
                    <option value="PART_TIME">Part time</option>
                    <option value="FULL_TIME">Full time</option>
                    <option value="TEMPORARY">Temporary</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="CAMPUS">Campus</option>
                    <option value="VOLUNTEER">Volunteer</option>
                    <option value="RESEARCH_ASSISTANT">
                      Research assistant
                    </option>
                  </select>
                </label>
                <label className="text-sm font-bold">
                  Experience level
                  <select
                    className={`${fieldClass} mt-2`}
                    onChange={(event) =>
                      update("experienceLevel", event.target.value)
                    }
                    value={state.experienceLevel}
                  >
                    <option value="UNSPECIFIED">Not specified</option>
                    <option value="NO_EXPERIENCE">No experience</option>
                    <option value="ENTRY_LEVEL">Entry level</option>
                    <option value="INTERMEDIATE">Intermediate</option>
                    <option value="EXPERIENCED">Experienced</option>
                  </select>
                </label>
                <label className="text-sm font-bold">
                  Minimum compensation
                  <input
                    className={`${fieldClass} mt-2`}
                    inputMode="decimal"
                    onChange={(event) =>
                      update("salaryMin", event.target.value)
                    }
                    value={state.salaryMin}
                  />
                </label>
                <label className="text-sm font-bold">
                  Maximum compensation
                  <input
                    className={`${fieldClass} mt-2`}
                    inputMode="decimal"
                    onChange={(event) =>
                      update("salaryMax", event.target.value)
                    }
                    value={state.salaryMax}
                  />
                </label>
                <label className="text-sm font-bold">
                  Paid status
                  <select
                    className={`${fieldClass} mt-2`}
                    onChange={(event) => update("paid", event.target.value)}
                    value={state.paid}
                  >
                    <option value="UNSPECIFIED">Not specified</option>
                    <option value="PAID">Paid</option>
                    <option value="UNPAID">Unpaid</option>
                  </select>
                </label>
                <label className="text-sm font-bold">
                  Weekly hours
                  <input
                    className={`${fieldClass} mt-2`}
                    inputMode="numeric"
                    onChange={(event) =>
                      update("weeklyHours", event.target.value)
                    }
                    value={state.weeklyHours}
                  />
                </label>
              </div>
            ) : null}
            <label className="block text-sm font-bold">
              Benefits, one per line
              <textarea
                className={`${textareaClass} mt-2`}
                onChange={(event) => update("benefits", event.target.value)}
                placeholder={
                  "HOUSING_SUPPORT | Campus housing support | CONFIRMED\nMEALS | Meal allowance | POSSIBLE"
                }
                value={state.benefits}
              />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Format: Type | Description | CONFIRMED, POSSIBLE or
                NOT_SPECIFIED
              </span>
            </label>
            <fieldset>
              <legend className="text-sm font-bold">Required documents</legend>
              {structureLocked ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Locked because applications already exist.
                </p>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {DOCUMENTS.map((document) => (
                    <label
                      className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 text-sm"
                      key={document}
                    >
                      <input
                        checked={state.requirements.includes(document)}
                        onChange={(event) =>
                          update(
                            "requirements",
                            event.target.checked
                              ? [...state.requirements, document]
                              : state.requirements.filter(
                                  (item) => item !== document,
                                ),
                          )
                        }
                        type="checkbox"
                      />
                      {document.replaceAll("_", " ")}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <h2 className="text-lg font-black">Dates and application method</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">
                Opens
                <input
                  className={`${fieldClass} mt-2`}
                  onChange={(event) =>
                    update("applicationOpenAt", event.target.value)
                  }
                  type="datetime-local"
                  value={state.applicationOpenAt}
                />
              </label>
              <label className="text-sm font-bold">
                Deadline
                <input
                  className={`${fieldClass} mt-2`}
                  disabled={state.rollingApplications}
                  onChange={(event) =>
                    update("applicationDeadline", event.target.value)
                  }
                  type="datetime-local"
                  value={state.applicationDeadline}
                />
              </label>
            </div>
            <label className="flex items-center gap-3 text-sm font-bold">
              <input
                checked={state.rollingApplications}
                onChange={(event) =>
                  update("rollingApplications", event.target.checked)
                }
                type="checkbox"
              />
              Rolling applications
            </label>
            <label className="block text-sm font-bold">
              Application method
              <select
                className={`${fieldClass} mt-2`}
                onChange={(event) =>
                  update("applicationMethod", event.target.value)
                }
                value={state.applicationMethod}
              >
                <option value="KONDO_APPLICATION">Apply inside Kondo</option>
                <option value="EXTERNAL_URL">Official external website</option>
                <option value="EMAIL">Professional email</option>
                <option value="INFORMATION_ONLY">Information only</option>
                <option value="NOMINATION_REQUIRED">Nomination required</option>
              </select>
            </label>
            {state.applicationMethod === "EXTERNAL_URL" ? (
              <label className="block text-sm font-bold">
                Application URL
                <input
                  className={`${fieldClass} mt-2`}
                  data-field="externalApplicationUrl"
                  onChange={(event) =>
                    update("externalApplicationUrl", event.target.value)
                  }
                  placeholder="https://"
                  value={state.externalApplicationUrl}
                />
                {fieldErrors.externalApplicationUrl ? (
                  <span
                    className="mt-1.5 block text-xs font-bold text-destructive"
                    role="alert"
                  >
                    {fieldErrors.externalApplicationUrl}
                  </span>
                ) : null}
              </label>
            ) : null}
            {state.applicationMethod === "EMAIL" ? (
              <label className="block text-sm font-bold">
                Application email
                <input
                  className={`${fieldClass} mt-2`}
                  onChange={(event) =>
                    update("applicationEmail", event.target.value)
                  }
                  type="email"
                  value={state.applicationEmail}
                />
              </label>
            ) : null}
            <label className="block text-sm font-bold">
              Official source URL
              <input
                className={`${fieldClass} mt-2`}
                onChange={(event) =>
                  update("officialSourceUrl", event.target.value)
                }
                placeholder="https://"
                value={state.officialSourceUrl}
              />
            </label>
            {!structureLocked ? (
              <label className="block text-sm font-bold">
                Application questions, one per line
                <textarea
                  className={`${textareaClass} mt-2`}
                  onChange={(event) => update("questions", event.target.value)}
                  placeholder={
                    "Why are you interested in this opportunity?\nDescribe a relevant experience."
                  }
                  value={state.questions}
                />
              </label>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-black">Review and presentation</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Nothing is published automatically. Submission sends this draft
                to the review workflow.
              </p>
            </div>
            <dl className="grid gap-3 rounded-2xl bg-muted/55 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold text-muted-foreground">
                  Title
                </dt>
                <dd className="mt-1 font-bold">
                  {state.title || "Not completed"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-muted-foreground">
                  Type
                </dt>
                <dd className="mt-1 font-bold">
                  {state.type.replaceAll("_", " ")}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-muted-foreground">
                  Application
                </dt>
                <dd className="mt-1 font-bold">
                  {state.applicationMethod.replaceAll("_", " ")}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-muted-foreground">
                  Deadline
                </dt>
                <dd className="mt-1 font-bold">
                  {state.rollingApplications
                    ? "Rolling"
                    : state.applicationDeadline || "Not specified"}
                </dd>
              </div>
            </dl>
            <div className="rounded-2xl border border-dashed border-border p-4">
              <label className="flex cursor-pointer items-center gap-3 text-sm font-bold">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
                  <ImagePlus className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">Cover image</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {cover?.name ??
                      (initial?.coverMediaId
                        ? "Current cover will be kept"
                        : "JPG, PNG or WebP · 8 MB max")}
                  </span>
                </span>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={chooseCover}
                  type="file"
                />
              </label>
              {uploadProgress !== null ? (
                <span className="mt-3 block">
                  <span className="block text-[11px] font-black text-muted-foreground">
                    Uploading {Math.round(uploadProgress)}%
                  </span>
                  <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-kondo-green transition-[width] duration-200 motion-reduce:transition-none"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </span>
                </span>
              ) : null}
              {cover ? (
                <input
                  aria-label="Cover image description"
                  className={`${fieldClass} mt-3`}
                  onChange={(event) => setCoverAlt(event.target.value)}
                  placeholder="Describe the cover image"
                  value={coverAlt}
                />
              ) : null}
            </div>
            <label className="flex items-start gap-3 rounded-2xl border border-border p-4 text-sm leading-6">
              <input
                checked={state.accuracyConfirmed}
                className="mt-1"
                onChange={(event) =>
                  update("accuracyConfirmed", event.target.checked)
                }
                type="checkbox"
              />
              <span>
                I confirm that the information, benefits, compensation and
                application destination are accurate and do not make guarantees
                Kondo cannot verify.
              </span>
            </label>
          </div>
        ) : null}
      </section>

      {error ? (
        <p
          className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {status ? (
        <p
          className="mt-4 flex items-center gap-2 text-sm font-semibold text-kondo-green"
          role="status"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          {status}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Button
          disabled={pending || step === 0}
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          variant="ghost"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex flex-wrap justify-end gap-2">
          {step === STEPS.length - 1 ? (
            <>
              <Button
                disabled={pending}
                onClick={() => void save(false)}
                variant="secondary"
              >
                <Save className="h-4 w-4" />
                Save draft
              </Button>
              <Button
                disabled={pending || !state.accuracyConfirmed}
                onClick={() => void save(true)}
              >
                <Send className="h-4 w-4" />
                Submit for review
              </Button>
            </>
          ) : (
            <Button
              disabled={pending}
              onClick={() =>
                validateStep(step) &&
                setStep((current) => Math.min(STEPS.length - 1, current + 1))
              }
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </FocusedFormShell>
  );
}
