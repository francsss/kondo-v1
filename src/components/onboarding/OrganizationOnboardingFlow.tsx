"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Check, ImagePlus, ShieldCheck } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  FieldGrid,
  FieldSection,
  TextAreaField,
  TextField,
} from "@/components/onboarding/fields";
import {
  OnboardingShell,
  type OnboardingStepDefinition,
} from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { ORGANIZATION_TYPES } from "@/features/organizations/registry";
import { uploadMediaFile } from "@/lib/client-media";
import { missingOrganizationOnboardingRequirement } from "@/lib/onboarding-requirements";
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

const STEPS: OnboardingStepDefinition[] = [
  {
    key: "identity",
    label: "Identity",
    title: "Tell us who you represent",
    description:
      "You stay signed in through your personal account. This organization never receives a shared password.",
  },
  {
    key: "profile",
    label: "Profile",
    title: "What does the organization offer?",
    description:
      "Activity areas and a short introduction. These describe future activity and grant no publishing or verification permission.",
  },
  {
    key: "review",
    label: "Review",
    title: "Review before finishing",
    description:
      "Nothing here presents the organization as verified or official.",
  },
];

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
    Math.min(Math.max((initialOrganization?.setupStep ?? 1) - 1, 0), 2),
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
      step === 1 &&
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
      setStep(1);
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

  const missing = missingOrganizationOnboardingRequirement(form, step);
  const canContinue = !missing;

  if (complete) {
    return (
      <main className="relative grid min-h-[100dvh] place-items-center bg-background px-4 py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(120%_100%_at_50%_0%,rgb(var(--brand)/0.16),transparent_70%)]"
        />
        <section className="relative w-full max-w-2xl rounded-4xl border border-border bg-card p-7 text-center shadow-soft sm:p-12">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
            <Check className="h-8 w-8" />
          </span>
          <h1 className="mt-6 text-balance text-3xl font-black tracking-tight text-kondo-ink dark:text-white">
            Organization setup complete
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-pretty text-sm leading-6 text-muted-foreground">
            {form.publicName} is ready inside Kondo. Verification is a separate
            review and no verified badge has been granted.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
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
      </main>
    );
  }

  return (
    <OnboardingShell
      action={
        step === STEPS.length - 1 ? (
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
        )
      }
      backDisabled={loading || step === 0}
      error={error}
      eyebrow="Organization setup"
      hint={missing}
      onBack={() => setStep((current) => Math.max(0, current - 1))}
      step={step}
      steps={STEPS}
    >
      {step === 0 ? (
        <IdentityStep
          availableCities={availableCities}
          countries={countries}
          form={form}
          setForm={setForm}
        />
      ) : null}
      {step === 1 ? (
        <div className="grid gap-7">
          <FieldSection
            hint="Choose everything the organization plans to do on Kondo."
            title="Activity areas"
          >
            <div className="grid gap-2.5 sm:grid-cols-2">
              {ORGANIZATION_CAPABILITIES.map((capability) => {
                const Icon = capability.icon;
                const selected = form.capabilities.includes(capability.key);
                return (
                  <button
                    aria-pressed={selected}
                    className={cn(
                      "rounded-3xl border p-4 text-left outline-none transition motion-reduce:transition-none",
                      "focus-visible:ring-4 focus-visible:ring-kondo-green/20",
                      selected
                        ? "border-kondo-green bg-kondo-mint text-kondo-forest shadow-sm dark:bg-emerald-400/10 dark:text-emerald-200"
                        : "border-border bg-background hover:border-kondo-green/50 hover:bg-muted/60",
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
                    <span className="flex items-center justify-between gap-2">
                      <Icon className="h-5 w-5 text-kondo-green" />
                      {selected ? (
                        <Check className="h-4 w-4 shrink-0" />
                      ) : null}
                    </span>
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
          </FieldSection>

          <FieldSection
            hint="A short, factual introduction helps people understand the organization."
            title="Introduction"
          >
            <TextAreaField
              label="Short description"
              maxLength={500}
              onChange={(shortDescription) =>
                setForm({ ...form, shortDescription })
              }
              placeholder="Describe what the organization does and who it serves."
              value={form.shortDescription}
            />
          </FieldSection>

          <FieldSection title="Contact (optional)">
            <FieldGrid>
              <WebsiteField
                error={websiteError}
                onBlur={(website) => {
                  const normalized = normalizeWebsiteUrl(website);
                  setForm((current) => ({ ...current, website: normalized }));
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
                value={form.website}
              />
              <TextField
                autoComplete="email"
                label="Professional email"
                onChange={(professionalEmail) =>
                  setForm({ ...form, professionalEmail })
                }
                placeholder="contact@example.org"
                value={form.professionalEmail}
              />
              <TextField
                autoComplete="tel"
                inputMode="tel"
                label="Professional phone"
                onChange={(professionalPhone) =>
                  setForm({ ...form, professionalPhone })
                }
                placeholder="+86…"
                value={form.professionalPhone}
              />
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-kondo-ink dark:text-white">
                  Logo
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
            </FieldGrid>
          </FieldSection>
        </div>
      ) : null}
      {step === 2 ? (
        <ReviewCard
          capabilities={form.capabilities}
          city={availableCities.find((city) => city.id === form.cityId)}
          country={countries.find((country) => country.id === form.countryId)}
          description={form.shortDescription}
          logoMediaId={form.logoMediaId}
          name={form.publicName}
          type={
            ORGANIZATION_TYPES.find(({ key }) => key === form.type)?.label ??
            form.type
          }
        />
      ) : null}
    </OnboardingShell>
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
    <div className="grid gap-7">
      <FieldSection title="Organization identity">
        <TextField
          label="Public organization name"
          maxLength={160}
          onChange={(publicName) => setForm({ ...form, publicName })}
          placeholder="Jiaxing International Student Association"
          value={form.publicName}
        />
        <SearchableSelect
          emptyMessage="No organization type matches your search."
          label="Organization type"
          onSelect={(type) => setForm({ ...form, type })}
          options={ORGANIZATION_TYPES.map(({ key, label }) => ({
            id: key,
            name: label,
          }))}
          placeholder="Select a type"
          searchPlaceholder="Search types…"
          selected={form.type}
        />
      </FieldSection>

      <FieldSection title="Where it operates">
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
      </FieldSection>

      <TextField
        hint="Only needed if it differs from the public name. You can add it later."
        label="Legal name (optional)"
        maxLength={200}
        onChange={(legalName) => setForm({ ...form, legalName })}
        placeholder="Registered legal name"
        value={form.legalName}
      />
    </div>
  );
}

function WebsiteField({
  value,
  onChange,
  onBlur,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-kondo-ink dark:text-white">
        Website
      </span>
      <input
        aria-describedby={error ? "organization-website-error" : undefined}
        aria-invalid={Boolean(error)}
        className={cn(
          "kondo-field h-12 w-full rounded-2xl border bg-background px-4 text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-sm",
          error ? "border-red-500" : "border-border",
        )}
        onBlur={(event) => onBlur(event.target.value)}
        onChange={(event) => onChange(event.target.value)}
        placeholder="https://example.org"
        type="url"
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
      <div className="bg-gradient-to-br from-kondo-forest to-kondo-green p-5 text-white sm:p-6">
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
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/65">
              Draft organization
            </p>
            <h2 className="mt-1 text-balance text-2xl font-black">{name}</h2>
            <p className="mt-1 text-sm text-white/75">
              {[type, [city?.name, country?.name].filter(Boolean).join(", ")]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <p className="text-pretty text-sm leading-6 text-muted-foreground">
          {description}
        </p>
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

