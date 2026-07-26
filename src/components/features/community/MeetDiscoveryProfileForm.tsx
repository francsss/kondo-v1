"use client";

import {
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  MEET_DISTANCE_OPTIONS,
  MEET_INTENTS,
  MEET_LANGUAGE_OPTIONS,
} from "@/features/meet/config";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { cn } from "@/lib/utils";

export type MeetProfileData = {
  userId: string;
  gender: "MALE" | "FEMALE";
  interestedIn: "ALL" | "MALE" | "FEMALE";
  birthYear: number | null;
  minimumAge: number;
  maximumAge: number;
  preferredLanguages: string[];
  lookingFor: string[];
  distanceRange: "KM_5" | "KM_10" | "KM_20" | "CITY" | "OTHER_CITY";
  otherCityId: string | null;
  nearbyVisibility: boolean;
  showAge: boolean;
  showNationality: boolean;
  showUniversity: boolean;
  showRelationshipStatus: boolean;
  showLanguages: boolean;
  showInterests: boolean;
  completedAt: string | Date | null;
};

type FormState = Omit<
  MeetProfileData,
  "userId" | "completedAt" | "birthYear"
> & {
  birthYear: string;
};

const inputClass =
  "h-12 w-full min-w-0 rounded-2xl border border-border bg-background px-4 text-base outline-none transition focus:border-kondo-green focus:ring-4 focus:ring-kondo-green/10";

function privacyOption(
  key:
    | "showAge"
    | "showNationality"
    | "showUniversity"
    | "showRelationshipStatus"
    | "showLanguages"
    | "showInterests",
  label: string,
  description: string,
) {
  return { key, label, description };
}

const privacyOptions = [
  privacyOption("showAge", "Age", "Show your age in discovery previews."),
  privacyOption(
    "showNationality",
    "Nationality",
    "Show your country and flag.",
  ),
  privacyOption(
    "showUniversity",
    "University",
    "Show your current university.",
  ),
  privacyOption(
    "showLanguages",
    "Languages",
    "Help people find language partners.",
  ),
  privacyOption("showInterests", "Looking For", "Show why you are using Meet."),
  privacyOption(
    "showRelationshipStatus",
    "Relationship status",
    "Future-ready privacy control; Kondo does not currently display it.",
  ),
] as const;

export function MeetDiscoveryProfileForm({
  profile,
  initialGender,
  initialLanguages,
  currentCity,
  currentCountry,
  currentUniversity,
  cityOptions,
  required,
  onCancel,
  onSaved,
}: {
  profile: MeetProfileData | null;
  initialGender: "MALE" | "FEMALE" | null;
  initialLanguages: string[];
  currentCity: string | null;
  currentCountry: string | null;
  currentUniversity: string | null;
  cityOptions: Array<{ id: string; name: string }>;
  required: boolean;
  onCancel?: () => void;
  onSaved: (profile: MeetProfileData) => void;
}) {
  const defaultLanguages = initialLanguages.filter((language) =>
    MEET_LANGUAGE_OPTIONS.includes(
      language as (typeof MEET_LANGUAGE_OPTIONS)[number],
    ),
  );
  const [form, setForm] = useState<FormState>(() => ({
    gender: profile?.gender ?? initialGender ?? "MALE",
    interestedIn: profile?.interestedIn ?? "ALL",
    birthYear: profile?.birthYear ? String(profile.birthYear) : "",
    minimumAge: profile?.minimumAge ?? 18,
    maximumAge: profile?.maximumAge ?? 40,
    preferredLanguages: profile?.preferredLanguages.length
      ? profile.preferredLanguages
      : defaultLanguages,
    lookingFor: profile?.lookingFor.length
      ? profile.lookingFor
      : MEET_INTENTS.map(([value]) => value),
    distanceRange: profile?.distanceRange ?? "CITY",
    otherCityId: profile?.otherCityId ?? null,
    nearbyVisibility: profile?.nearbyVisibility ?? true,
    showAge: profile?.showAge ?? true,
    showNationality: profile?.showNationality ?? true,
    showUniversity: profile?.showUniversity ?? true,
    showRelationshipStatus: profile?.showRelationshipStatus ?? true,
    showLanguages: profile?.showLanguages ?? true,
    showInterests: profile?.showInterests ?? true,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const enabledPrivacyCount = useMemo(
    () => privacyOptions.filter(({ key }) => form[key]).length,
    [form],
  );

  function toggleArray(
    field: "preferredLanguages" | "lookingFor",
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value],
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.lookingFor.length) {
      setError("Choose at least one reason for using Meet.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/meet/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          birthYear: form.birthYear ? Number(form.birthYear) : null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Your Meet profile could not be saved.",
        );
      }
      onSaved(payload.profile as MeetProfileData);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your Meet profile could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-5xl overflow-hidden p-0 shadow-lift">
      <div className="bg-gradient-to-br from-kondo-navy via-kondo-forest to-[#218267] px-5 py-7 text-white sm:px-8 sm:py-9">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-kondo-lime">
          <Sparkles className="h-3.5 w-3.5" />
          {required ? "Your Meet introduction" : "Meet Settings"}
        </span>
        <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">
          {required
            ? "Shape the people you discover."
            : "Tune your discovery experience."}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
          Meet is for friendship, study, networking and meaningful student
          connections. Every visibility option starts enabled and remains under
          your control.
        </p>
      </div>

      <form className="space-y-8 p-5 sm:p-8" onSubmit={submit}>
        <section>
          <div className="flex items-center gap-3">
            <Settings2 className="h-5 w-5 text-kondo-green" />
            <div>
              <h3 className="font-black">Discovery preferences</h3>
              <p className="text-xs text-muted-foreground">
                Preferences are private and checked in both directions.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label>
              <span className="mb-2 block text-sm font-bold">Gender</span>
              <select
                className={inputClass}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    gender: event.target.value as "MALE" | "FEMALE",
                  }))
                }
                value={form.gender}
              >
                <option value="MALE">Man</option>
                <option value="FEMALE">Woman</option>
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold">
                Interested in
              </span>
              <select
                className={inputClass}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    interestedIn: event.target.value as
                      "ALL" | "MALE" | "FEMALE",
                  }))
                }
                value={form.interestedIn}
              >
                <option value="ALL">Everyone</option>
                <option value="MALE">Men</option>
                <option value="FEMALE">Women</option>
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold">
                Year of birth
              </span>
              <input
                className={inputClass}
                inputMode="numeric"
                max={new Date().getUTCFullYear() - 18}
                min={1940}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    birthYear: event.target.value,
                  }))
                }
                placeholder="Optional"
                type="number"
                value={form.birthYear}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="mb-2 block text-sm font-bold">Min age</span>
                <input
                  className={inputClass}
                  max={80}
                  min={18}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      minimumAge: Number(event.target.value),
                    }))
                  }
                  type="number"
                  value={form.minimumAge}
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-bold">Max age</span>
                <input
                  className={inputClass}
                  max={80}
                  min={18}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      maximumAge: Number(event.target.value),
                    }))
                  }
                  type="number"
                  value={form.maximumAge}
                />
              </label>
            </div>
          </div>
        </section>

        <section>
          <h3 className="font-black">Looking For</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Keep every option selected for broader discovery, or personalize it.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MEET_INTENTS.map(([value, label]) => {
              const selected = form.lookingFor.includes(value);
              return (
                <button
                  aria-pressed={selected}
                  className={cn(
                    "rounded-2xl border px-3 py-3 text-left text-xs transition active:scale-[0.98]",
                    selected
                      ? "border-kondo-green bg-kondo-mint font-black text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
                      : "border-border font-bold text-muted-foreground hover:border-kondo-green/40",
                  )}
                  key={value}
                  onClick={() => toggleArray("lookingFor", value)}
                  type="button"
                >
                  {selected ? <Check className="mb-1 h-3.5 w-3.5" /> : null}
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="font-black">Languages</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Select the languages you would enjoy using with new people.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {MEET_LANGUAGE_OPTIONS.map((language) => {
              const selected = form.preferredLanguages.includes(language);
              return (
                <button
                  aria-pressed={selected}
                  className={cn(
                    "rounded-full border px-3 py-2 text-xs font-bold transition",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-kondo-green",
                  )}
                  key={language}
                  onClick={() => toggleArray("preferredLanguages", language)}
                  type="button"
                >
                  {language}
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h3 className="font-black">Nearby discovery</h3>
            <label className="mt-4 flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4">
              <input
                checked={form.nearbyVisibility}
                className="mt-1"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    nearbyVisibility: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-black">
                  Discoverable by default
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  Uses your study city or campus area—never live GPS or exact
                  coordinates.
                </span>
              </span>
            </label>
            <div className="mt-4">
              <span className="mb-2 block text-sm font-bold">
                Default discovery range
              </span>
              <div className="grid grid-cols-2 gap-2">
                {MEET_DISTANCE_OPTIONS.filter(
                  (option) => option.value !== "OTHER_CITY",
                ).map((option) => (
                  <button
                    aria-pressed={form.distanceRange === option.value}
                    className={cn(
                      "rounded-2xl border px-3 py-2.5 text-xs font-bold transition",
                      form.distanceRange === option.value
                        ? "border-kondo-green bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
                        : "border-border text-muted-foreground",
                    )}
                    key={option.value}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        distanceRange: option.value,
                        otherCityId: null,
                      }))
                    }
                    type="button"
                  >
                    {option.label}
                    {option.premium ? " · Premium" : ""}
                  </button>
                ))}
              </div>
            </div>
            {form.distanceRange === "OTHER_CITY" ? (
              <div className="mt-4">
                <SearchableSelect
                  label="Another city"
                  onSelect={(value) =>
                    setForm((current) => ({
                      ...current,
                      otherCityId: value || null,
                    }))
                  }
                  options={cityOptions}
                  placeholder="Choose a city"
                  searchPlaceholder="Search cities"
                  selected={form.otherCityId ?? ""}
                />
              </div>
            ) : null}
          </div>

          <div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 className="font-black">Preview privacy</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {enabledPrivacyCount} of {privacyOptions.length} details
                  enabled.
                </p>
              </div>
              <ShieldCheck className="h-5 w-5 text-kondo-green" />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {privacyOptions.map(({ key, label, description }) => {
                const enabled = form[key];
                return (
                  <label
                    className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-3 transition hover:bg-muted/50"
                    key={key}
                  >
                    <input
                      checked={enabled}
                      className="sr-only"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          [key]: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    {enabled ? (
                      <Eye className="mt-0.5 h-4 w-4 shrink-0 text-kondo-green" />
                    ) : (
                      <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span>
                      <span className="block text-xs font-black">{label}</span>
                      <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                        {description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </section>

        <div className="rounded-2xl border border-border bg-muted/40 p-4 text-xs leading-5 text-muted-foreground">
          Current profile context: {currentUniversity ?? "University not set"} ·{" "}
          {currentCity ?? "City not set"} ·{" "}
          {currentCountry ?? "Nationality not set"}. Update those values from
          your{" "}
          <Link
            className="font-black text-kondo-green underline underline-offset-2"
            href="/profile/edit"
          >
            Kondo profile
          </Link>{" "}
          when needed.
        </div>

        {error ? (
          <p
            className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 dark:bg-red-400/10 dark:text-red-300"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {!required && onCancel ? (
            <Button
              disabled={busy}
              onClick={onCancel}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
          ) : null}
          <Button disabled={busy} type="submit">
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {busy ? "Saving…" : required ? "Enter Meet" : "Save settings"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
