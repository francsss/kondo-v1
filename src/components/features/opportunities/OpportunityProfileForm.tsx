"use client";

import { useState } from "react";
import { Check, LoaderCircle } from "lucide-react";

const TYPES = [
  ["SCHOLARSHIP", "Scholarships"],
  ["INTERNSHIP", "Internships"],
  ["PART_TIME_JOB", "Part-time jobs"],
  ["FULL_TIME_JOB", "Full-time jobs"],
  ["RESEARCH_OPPORTUNITY", "Research"],
  ["EXCHANGE_PROGRAM", "Exchange programs"],
  ["VOLUNTEERING", "Volunteering"],
] as const;

function listFromText(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function errorMessage(value: unknown) {
  if (value && typeof value === "object" && "error" in value) {
    const error = (value as { error?: unknown }).error;
    if (typeof error === "string") return error;
  }
  return "Your changes could not be saved.";
}

export type OpportunityProfileValue = {
  preferredTypes: string[];
  remotePreference: string | null;
  experienceLevel: string;
  availabilityFrom: string;
  professionalInterests: string[];
  skills: string[];
  workAuthorizationNote: string;
  portfolioUrl: string;
  professionalProfileUrl: string;
  coverLetterTemplate: string;
  recommendationsEnabled: boolean;
  deadlineReminderDays: number[];
};

export function OpportunityProfileForm({
  initial,
  mode,
}: {
  initial: OpportunityProfileValue;
  mode: "profile" | "preferences";
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    const response = await fetch("/api/opportunities/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...value,
        availabilityFrom: value.availabilityFrom || null,
        remotePreference: value.remotePreference || null,
        portfolioUrl: value.portfolioUrl || null,
        professionalProfileUrl: value.professionalProfileUrl || null,
        workAuthorizationNote: value.workAuthorizationNote || null,
        coverLetterTemplate: value.coverLetterTemplate || null,
      }),
    });
    const payload = (await response.json()) as unknown;
    setStatus(response.ok ? "Saved" : errorMessage(payload));
    setBusy(false);
  }

  return (
    <div className="mt-7 space-y-6">
      {mode === "profile" ? (
        <>
          <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:p-6">
            <h2 className="text-lg font-black">Professional profile</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Reuse accurate information across future applications. Nothing is
              shared until you submit an application.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">
                Experience level
                <select
                  value={value.experienceLevel}
                  onChange={(event) =>
                    setValue((current) => ({
                      ...current,
                      experienceLevel: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-background px-4 py-3 font-normal dark:border-white/10"
                >
                  <option value="UNSPECIFIED">Not specified</option>
                  <option value="NO_EXPERIENCE">No experience yet</option>
                  <option value="ENTRY_LEVEL">Entry level</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="EXPERIENCED">Experienced</option>
                </select>
              </label>
              <label className="text-sm font-bold">
                Available from
                <input
                  type="date"
                  value={value.availabilityFrom}
                  onChange={(event) =>
                    setValue((current) => ({
                      ...current,
                      availabilityFrom: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 font-normal dark:border-white/10"
                />
              </label>
              <TextListField
                label="Skills"
                value={value.skills}
                placeholder="Python, research, public speaking"
                onChange={(skills) =>
                  setValue((current) => ({ ...current, skills }))
                }
              />
              <TextListField
                label="Professional interests"
                value={value.professionalInterests}
                placeholder="Fintech, sustainability, design"
                onChange={(professionalInterests) =>
                  setValue((current) => ({
                    ...current,
                    professionalInterests,
                  }))
                }
              />
              <UrlField
                label="Portfolio URL"
                value={value.portfolioUrl}
                onChange={(portfolioUrl) =>
                  setValue((current) => ({ ...current, portfolioUrl }))
                }
              />
              <UrlField
                label="Professional profile URL"
                value={value.professionalProfileUrl}
                onChange={(professionalProfileUrl) =>
                  setValue((current) => ({
                    ...current,
                    professionalProfileUrl,
                  }))
                }
              />
            </div>
            <label className="mt-4 block text-sm font-bold">
              Work authorization note
              <textarea
                rows={3}
                maxLength={500}
                value={value.workAuthorizationNote}
                onChange={(event) =>
                  setValue((current) => ({
                    ...current,
                    workAuthorizationNote: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 font-normal dark:border-white/10"
              />
            </label>
            <label className="mt-4 block text-sm font-bold">
              Reusable cover letter draft
              <textarea
                rows={8}
                maxLength={10000}
                value={value.coverLetterTemplate}
                onChange={(event) =>
                  setValue((current) => ({
                    ...current,
                    coverLetterTemplate: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 font-normal dark:border-white/10"
              />
            </label>
          </section>
        </>
      ) : (
        <>
          <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:p-6">
            <h2 className="text-lg font-black">What you want to see</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {TYPES.map(([key, label]) => {
                const selected = value.preferredTypes.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setValue((current) => ({
                        ...current,
                        preferredTypes: selected
                          ? current.preferredTypes.filter(
                              (item) => item !== key,
                            )
                          : [...current.preferredTypes, key],
                      }))
                    }
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      selected
                        ? "bg-kondo-green text-white"
                        : "bg-black/5 hover:bg-black/10 dark:bg-white/10"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <label className="mt-5 block text-sm font-bold">
              Preferred work mode
              <select
                value={value.remotePreference ?? ""}
                onChange={(event) =>
                  setValue((current) => ({
                    ...current,
                    remotePreference: event.target.value || null,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-black/10 bg-background px-4 py-3 font-normal dark:border-white/10 sm:max-w-sm"
              >
                <option value="">No preference</option>
                <option value="ON_SITE">On site</option>
                <option value="REMOTE">Remote</option>
                <option value="HYBRID">Hybrid</option>
                <option value="CAMPUS">On campus</option>
              </select>
            </label>
          </section>
          <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:p-6">
            <h2 className="text-lg font-black">Recommendations & reminders</h2>
            <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={value.recommendationsEnabled}
                onChange={(event) =>
                  setValue((current) => ({
                    ...current,
                    recommendationsEnabled: event.target.checked,
                  }))
                }
                className="mt-1 accent-kondo-green"
              />
              <span>
                <strong className="block">Personalized recommendations</strong>
                <span className="text-muted-foreground">
                  Let Kondo use these preferences to surface relevant
                  opportunities. This is off by default.
                </span>
              </span>
            </label>
            <fieldset className="mt-5">
              <legend className="text-sm font-bold">
                Default deadline reminders
              </legend>
              <div className="mt-3 flex flex-wrap gap-3">
                {[14, 7, 3, 1].map((days) => (
                  <label key={days} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={value.deadlineReminderDays.includes(days)}
                      onChange={(event) =>
                        setValue((current) => ({
                          ...current,
                          deadlineReminderDays: event.target.checked
                            ? [...current.deadlineReminderDays, days]
                            : current.deadlineReminderDays.filter(
                                (item) => item !== days,
                              ),
                        }))
                      }
                      className="accent-kondo-green"
                    />
                    {days} day{days === 1 ? "" : "s"} before
                  </label>
                ))}
              </div>
            </fieldset>
          </section>
        </>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-kondo-green px-6 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Save changes
        </button>
        {status ? (
          <p
            role="status"
            className={`text-sm font-semibold ${status === "Saved" ? "text-kondo-green" : "text-rose-600"}`}
          >
            {status}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TextListField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string[];
  placeholder: string;
  onChange: (value: string[]) => void;
}) {
  return (
    <label className="text-sm font-bold">
      {label}
      <input
        defaultValue={value.join(", ")}
        onChange={(event) => onChange(listFromText(event.target.value))}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 font-normal dark:border-white/10"
      />
    </label>
  );
}

function UrlField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-bold">
      {label}
      <input
        type="url"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="https://"
        className="mt-2 w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 font-normal dark:border-white/10"
      />
    </label>
  );
}
