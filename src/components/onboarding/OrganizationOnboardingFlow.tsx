"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ImagePlus,
  ShieldCheck,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { ORGANIZATION_TYPES } from "@/features/organizations/registry";
import { uploadMediaFile } from "@/lib/client-media";
import { ORGANIZATION_CAPABILITIES } from "@/lib/organization-capabilities";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { cn } from "@/lib/utils";
import {
  isHttpWebsiteUrl,
  normalizeWebsiteUrl,
  WEBSITE_URL_ERROR,
} from "@/lib/website-url";

type CountryOption = {
  id: string;
  name: string;
};
type CityOption = {
  id: string;
  name: string;
  secondary?: string;
  countryId: string;
};
type OrganizationSetup = {
  id: string;
  slug: string;
  publicName: string;
  legalName: string | null;
  type: string;
  shortDescription: string | null;
  countryId: string;
  cityId: string | null;
  website: string | null;
  professionalEmail: string | null;
  professionalPhone: string | null;
  logoMediaId: string | null;
  lifecycleStatus: string;
  verificationStatus: string;
  setupStep: number;
  setupCompletedAt: string | null;
  capabilities: string[];
  country: { name: string; emoji: string | null };
  city: { name: string } | null;
};

const stepLabels = ["Identity", "Activity areas", "Introduction", "Review"];

export function OrganizationOnboardingFlow({
  initialOrganization,
  countries,
  cities,
}: {
  initialOrganization: OrganizationSetup | null;
  countries: CountryOption[];
  cities: CityOption[];
}) {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState(
    initialOrganization?.id ?? "",
  );
  const [organizationSlug, setOrganizationSlug] = useState(
    initialOrganization?.slug ?? "",
  );
  const [step, setStep] = useState(
    Math.min(Math.max((initialOrganization?.setupStep ?? 1) - 1, 0), 3),
  );
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [websiteError, setWebsiteError] = useState("");
  const [complete, setComplete] = useState(
    Boolean(initialOrganization?.setupCompletedAt),
  );
  const [form, setForm] = useState({
    publicName: initialOrganization?.publicName ?? "",
    legalName: initialOrganization?.legalName ?? "",
    type: initialOrganization?.type ?? "",
    countryId: initialOrganization?.countryId ?? "",
    cityId: initialOrganization?.cityId ?? "",
    capabilities: initialOrganization?.capabilities ?? [],
    shortDescription: initialOrganization?.shortDescription ?? "",
    website: initialOrganization?.website ?? "",
    professionalEmail: initialOrganization?.professionalEmail ?? "",
    professionalPhone: initialOrganization?.professionalPhone ?? "",
    logoMediaId: initialOrganization?.logoMediaId ?? "",
  });

  const availableCities = useMemo(
    () => cities.filter((city) => city.countryId === form.countryId),
    [cities, form.countryId],
  );

  useEffect(() => {
    captureProductEvent(PRODUCT_EVENTS.ORGANIZATION_ONBOARDING_STARTED, {
      resumed: Boolean(initialOrganization),
    });
  }, [initialOrganization]);

  async function saveDraft(nextStep: number) {
    const normalizedWebsite = normalizeWebsiteUrl(form.website);
    if (
      step === 2 &&
      normalizedWebsite &&
      !isHttpWebsiteUrl(normalizedWebsite)
    ) {
      setWebsiteError(WEBSITE_URL_ERROR);
      setError("");
      return false;
    }
    const draft = { ...form, website: normalizedWebsite };
    if (normalizedWebsite !== form.website) {
      setForm(draft);
    }
    setWebsiteError("");
    setLoading(true);
    setError("");
    try {
      if (!organizationId) {
        const response = await fetch("/api/organizations", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicName: form.publicName,
            type: form.type,
            countryId: form.countryId,
            cityId: form.cityId || undefined,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(data.error ?? "Could not create the organization draft.");
          return false;
        }
        setOrganizationId(data.organization.id);
        setOrganizationSlug(data.organization.slug);
        setStep(nextStep);
        return true;
      }
      const response = await fetch(
        `/api/organizations/${organizationId}/onboarding`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...draft, setupStep: nextStep + 1 }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Could not save the organization draft.");
        return false;
      }
      setStep(nextStep);
      return true;
    } catch {
      setError("Kondo could not save this draft. Check your connection.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function finish() {
    if (!organizationId) return;
    const normalizedWebsite = normalizeWebsiteUrl(form.website);
    if (normalizedWebsite && !isHttpWebsiteUrl(normalizedWebsite)) {
      setWebsiteError(WEBSITE_URL_ERROR);
      setError("");
      setStep(2);
      return;
    }
    const draft = { ...form, website: normalizedWebsite };
    if (normalizedWebsite !== form.website) {
      setForm(draft);
    }
    setWebsiteError("");
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/onboarding`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...draft, confirm: true }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Complete the required organization details.");
        return;
      }
      setComplete(true);
      captureProductEvent(PRODUCT_EVENTS.ORGANIZATION_ONBOARDING_COMPLETED, {
        organization_type: form.type,
      });
      router.refresh();
    } catch {
      setError("Kondo could not finish the setup. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setError("");
    try {
      const logoMediaId = await uploadMediaFile(file, {
        purpose: "ORGANIZATION_LOGO",
        altText: `${form.publicName || "Organization"} logo`,
        onProgress: setUploadProgress,
      });
      setForm((current) => ({ ...current, logoMediaId }));
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The logo could not be uploaded.",
      );
    } finally {
      setUploading(false);
    }
  }

  const canContinue =
    step === 0
      ? Boolean(
          form.publicName.trim().length >= 2 && form.type && form.countryId,
        )
      : step === 1
        ? form.capabilities.length > 0
        : step === 2
          ? form.shortDescription.trim().length >= 20
          : true;

  if (complete) {
    return (
      <section className="mx-auto mt-14 max-w-2xl rounded-4xl border border-border bg-card p-8 text-center shadow-soft sm:p-12">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
          <Check className="h-8 w-8" />
        </span>
        <h1 className="mt-6 text-3xl font-black tracking-tight">
          Organization setup complete
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
          {form.publicName} is ready inside Kondo. Verification is a separate
          review and no verified badge has been granted.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link
              href={
                organizationSlug
                  ? `/organizations/${organizationSlug}/dashboard`
                  : "/settings/organizations"
              }
            >
              Open organization workspace
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/settings/organizations">View organizations</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-96px)] max-w-5xl items-center gap-8 py-8 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside aria-label="Organization setup progress">
        <div className="flex gap-2 lg:flex-col">
          {stepLabels.map((label, index) => (
            <div
              className={cn(
                "flex flex-1 items-center gap-3 rounded-2xl p-3",
                step === index && "bg-card shadow-sm",
              )}
              key={label}
            >
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black",
                  index < step
                    ? "bg-primary text-primary-foreground"
                    : step === index
                      ? "bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {index < step ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span className="hidden text-sm font-bold lg:block">{label}</span>
            </div>
          ))}
        </div>
      </aside>

      <section className="rounded-4xl border border-border bg-card p-6 shadow-soft sm:p-10">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
          Organization setup · Step {step + 1} of 4
        </p>
        <h1 className="mt-4 text-3xl font-black tracking-[-0.04em]">
          {step === 0
            ? "Tell us who you represent"
            : step === 1
              ? "What does the organization offer?"
              : step === 2
                ? "Create a clear introduction"
                : "Review before finishing"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {step === 0
            ? "You remain signed in through your personal account. This organization never receives a shared password."
            : step === 1
              ? "These choices describe future activity areas. They do not grant publishing or verification permissions."
              : step === 2
                ? "A short, factual introduction helps people understand the organization."
                : "Nothing here presents the organization as verified or official."}
        </p>

        <div className="mt-8 min-h-[310px]">
          {step === 0 ? (
            <IdentityStep
              availableCities={availableCities}
              countries={countries}
              form={form}
              setForm={setForm}
            />
          ) : null}
          {step === 1 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {ORGANIZATION_CAPABILITIES.map((capability) => {
                const Icon = capability.icon;
                const selected = form.capabilities.includes(capability.key);
                return (
                  <button
                    aria-pressed={selected}
                    className={cn(
                      "rounded-3xl border p-4 text-left outline-none transition focus-visible:ring-4 focus-visible:ring-kondo-green/20",
                      selected
                        ? "border-kondo-green bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
                        : "border-border bg-background hover:border-kondo-green/50",
                    )}
                    key={capability.key}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        capabilities: selected
                          ? current.capabilities.filter(
                              (key) => key !== capability.key,
                            )
                          : [...current.capabilities, capability.key],
                      }))
                    }
                    type="button"
                  >
                    <Icon className="h-5 w-5 text-kondo-green" />
                    <span className="mt-3 block text-sm font-black">
                      {capability.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {capability.description}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          {step === 2 ? (
            <div className="grid gap-5">
              <label>
                <span className="mb-2 block text-sm font-bold">
                  Short description
                </span>
                <textarea
                  className="min-h-28 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-kondo-green"
                  maxLength={500}
                  onChange={(event) =>
                    setForm({ ...form, shortDescription: event.target.value })
                  }
                  placeholder="Describe what the organization does and who it serves."
                  value={form.shortDescription}
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  {form.shortDescription.length}/500
                </span>
              </label>
              <div className="grid gap-5 sm:grid-cols-2">
                <TextInput
                  error={websiteError}
                  label="Website (optional)"
                  onBlur={(website) => {
                    const normalized = normalizeWebsiteUrl(website);
                    setForm((current) => ({
                      ...current,
                      website: normalized,
                    }));
                    setWebsiteError(
                      normalized && !isHttpWebsiteUrl(normalized)
                        ? WEBSITE_URL_ERROR
                        : "",
                    );
                  }}
                  onChange={(website) => {
                    setForm({ ...form, website });
                    if (websiteError) setWebsiteError("");
                  }}
                  placeholder="https://example.org"
                  type="url"
                  value={form.website}
                />
                <TextInput
                  label="Professional email (optional)"
                  onChange={(professionalEmail) =>
                    setForm({ ...form, professionalEmail })
                  }
                  placeholder="contact@example.org"
                  type="email"
                  value={form.professionalEmail}
                />
                <TextInput
                  label="Professional phone (optional)"
                  onChange={(professionalPhone) =>
                    setForm({ ...form, professionalPhone })
                  }
                  placeholder="+86…"
                  value={form.professionalPhone}
                />
                <label className="block">
                  <span className="mb-2 block text-sm font-bold">
                    Logo (optional)
                  </span>
                  <span className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background px-4 text-sm font-bold transition hover:border-kondo-green/60">
                    <ImagePlus className="h-4 w-4" />
                    {uploading
                      ? `Uploading ${uploadProgress}%`
                      : form.logoMediaId
                        ? "Logo ready"
                        : "Choose an image"}
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={uploading}
                      onChange={uploadLogo}
                      type="file"
                    />
                  </span>
                </label>
              </div>
            </div>
          ) : null}
          {step === 3 ? (
            <ReviewCard
              capabilities={form.capabilities}
              city={availableCities.find((city) => city.id === form.cityId)}
              country={countries.find(
                (country) => country.id === form.countryId,
              )}
              description={form.shortDescription}
              logoMediaId={form.logoMediaId}
              name={form.publicName}
              type={
                ORGANIZATION_TYPES.find(({ key }) => key === form.type)
                  ?.label ?? form.type
              }
            />
          ) : null}
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
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            variant="ghost"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step === 3 ? (
            <Button disabled={loading || !canContinue} onClick={finish}>
              {loading ? "Finishing…" : "Finish setup"}
              {!loading ? <Check className="h-4 w-4" /> : null}
            </Button>
          ) : (
            <Button
              disabled={loading || uploading || !canContinue}
              onClick={() => saveDraft(step + 1)}
            >
              {loading ? "Saving…" : "Save & continue"}
              {!loading ? <ArrowRight className="h-4 w-4" /> : null}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

type OrganizationForm = {
  publicName: string;
  legalName: string;
  type: string;
  countryId: string;
  cityId: string;
  capabilities: string[];
  shortDescription: string;
  website: string;
  professionalEmail: string;
  professionalPhone: string;
  logoMediaId: string;
};

function IdentityStep({
  form,
  setForm,
  countries,
  availableCities,
}: {
  form: OrganizationForm;
  setForm: React.Dispatch<React.SetStateAction<OrganizationForm>>;
  countries: CountryOption[];
  availableCities: CityOption[];
}) {
  return (
    <div className="grid gap-5">
      <TextInput
        label="Public organization name"
        onChange={(publicName) => setForm({ ...form, publicName })}
        placeholder="Jiaxing International Student Association"
        value={form.publicName}
      />
      <label>
        <span className="mb-2 block text-sm font-bold">Organization type</span>
        <select
          className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-kondo-green"
          onChange={(event) => setForm({ ...form, type: event.target.value })}
          value={form.type}
        >
          <option value="">Select a type</option>
          {ORGANIZATION_TYPES.map(({ key, label }) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <SearchableSelect
        label="Country"
        onSelect={(countryId) => setForm({ ...form, countryId, cityId: "" })}
        options={countries}
        placeholder="Select a country"
        searchPlaceholder="Search countries…"
        selected={form.countryId}
      />
      <SearchableSelect
        clearLabel="No city selected"
        disabled={!form.countryId}
        label="City (optional)"
        onSelect={(cityId) => setForm({ ...form, cityId })}
        options={availableCities}
        placeholder={
          form.countryId ? "Select a city" : "Select a country first"
        }
        searchPlaceholder="Search cities…"
        selected={form.cityId}
      />
      <TextInput
        label="Legal name (optional during setup)"
        onChange={(legalName) => setForm({ ...form, legalName })}
        placeholder="Registered legal name"
        value={form.legalName}
      />
    </div>
  );
}

function ReviewCard({
  name,
  type,
  country,
  city,
  description,
  capabilities,
  logoMediaId,
}: {
  name: string;
  type: string;
  country?: CountryOption;
  city?: CityOption;
  description: string;
  capabilities: string[];
  logoMediaId: string;
}) {
  return (
    <div className="overflow-hidden rounded-4xl border border-border bg-background shadow-sm">
      <div className="bg-gradient-to-br from-kondo-forest to-kondo-green p-6 text-white">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/15">
            {logoMediaId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={`${name} logo`}
                className="h-full w-full object-cover"
                src={`/api/media/${logoMediaId}`}
              />
            ) : (
              <Building2 className="h-8 w-8" />
            )}
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/65">
              Draft organization
            </p>
            <h2 className="mt-1 text-2xl font-black">{name}</h2>
            <p className="mt-1 text-sm text-white/75">
              {type} · {[city?.name, country?.name].filter(Boolean).join(", ")}
            </p>
          </div>
        </div>
      </div>
      <div className="p-6">
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {capabilities.map((key) => (
            <span
              className="rounded-full bg-muted px-3 py-1.5 text-xs font-bold"
              key={key}
            >
              {ORGANIZATION_CAPABILITIES.find((item) => item.key === key)
                ?.label ?? key}
            </span>
          ))}
        </div>
        <p className="mt-6 flex items-start gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-xs leading-5 text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-kondo-green" />
          Verification is separate. Completing setup does not grant an official
          badge or publishing permissions.
        </p>
      </div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "url";
  error?: string;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <input
        aria-describedby={error ? "organization-website-error" : undefined}
        aria-invalid={Boolean(error)}
        className={cn(
          "h-12 w-full rounded-2xl border bg-background px-4 text-sm outline-none focus:ring-4",
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
            : "border-border focus:border-kondo-green focus:ring-kondo-green/10",
        )}
        onBlur={(event) => onBlur?.(event.target.value)}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
      {error ? (
        <span
          className="mt-1.5 block text-xs font-semibold text-red-600 dark:text-red-300"
          id="organization-website-error"
        >
          {error}
        </span>
      ) : null}
    </label>
  );
}
