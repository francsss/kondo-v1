"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  UserRound,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { KondoLogo } from "@/components/KondoLogo";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { AFRICAN_COUNTRIES } from "@/lib/african-countries";
import {
  captureProductEvent,
  identifyProductUser,
  resetProductAnalytics,
} from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [countryCode, setCountryCode] = useState("");
  const [gender, setGender] = useState("");
  const [intent, setIntent] = useState<"PERSONAL" | "ORGANIZATION">("PERSONAL");

  useEffect(() => {
    resetProductAnalytics();
    captureProductEvent(PRODUCT_EVENTS.REGISTRATION_STARTED);
    captureProductEvent(PRODUCT_EVENTS.REGISTRATION_STEP_REACHED, {
      step: "account_details",
      step_number: 1,
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          email: form.get("email"),
          intent,
          gender: intent === "PERSONAL" ? form.get("gender") : undefined,
          countryCode:
            intent === "PERSONAL" ? form.get("countryCode") : undefined,
          password: form.get("password"),
          confirmPassword: form.get("confirmPassword"),
          acceptedTerms: form.get("acceptedTerms") === "on",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        captureProductEvent(PRODUCT_EVENTS.REGISTRATION_VALIDATION_ERROR, {
          step: "account_details",
          status: response.status,
          error_type:
            response.status === 409
              ? "account_exists"
              : response.status === 429
                ? "rate_limited"
                : "invalid_form",
        });
        setError(data.error ?? "We couldn’t create your account.");
        return;
      }
      identifyProductUser(data.user.id, {
        role: data.user.role,
        onboarding_completed: false,
      });
      router.replace(data.nextPath ?? "/onboarding");
      router.refresh();
    } catch {
      captureProductEvent(PRODUCT_EVENTS.REGISTRATION_VALIDATION_ERROR, {
        step: "account_details",
        error_type: "network_error",
      });
      setError("Kondo could not create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-5 py-6 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <KondoLogo />
        <div className="mt-10 grid gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
          <section className="pt-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
              Join the community
            </p>
            <h1 className="mt-4 text-balance text-4xl font-black tracking-[-0.05em] text-kondo-ink dark:text-white sm:text-5xl">
              Your student life in China starts here.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">
              Meet students who understand the journey, find trusted answers,
              and settle in with less friction.
            </p>
            <div className="mt-8 space-y-4">
              {[
                "Relevant communities from day one",
                "Student-tested guides and answers",
                "A safer local student marketplace",
              ].map((item) => (
                <div
                  className="flex items-center gap-3 text-sm font-semibold text-muted-foreground"
                  key={item}
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-4xl border border-border bg-card p-6 text-card-foreground shadow-soft sm:p-8">
            <h2 className="text-2xl font-black tracking-tight text-kondo-ink dark:text-white">
              Create your account
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Start with your own secure login. Organization details are added
              after account creation.
            </p>
            <form
              action="/api/auth/register"
              className="mt-7 grid gap-5 sm:grid-cols-2"
              method="post"
              onInvalid={(event) => {
                const target = event.target;
                captureProductEvent(
                  PRODUCT_EVENTS.REGISTRATION_VALIDATION_ERROR,
                  {
                    step: "account_details",
                    field:
                      target instanceof HTMLInputElement
                        ? target.name
                        : "unknown",
                    error_type: "browser_validation",
                  },
                );
              }}
              onSubmit={submit}
            >
              <fieldset className="sm:col-span-2">
                <legend className="mb-3 text-sm font-bold text-kondo-ink dark:text-white">
                  How would you like to start using Kondo?
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      value: "PERSONAL" as const,
                      title: "Personal account",
                      description:
                        "For students, future students, alumni and professionals.",
                      icon: UserRound,
                    },
                    {
                      value: "ORGANIZATION" as const,
                      title: "Organization",
                      description:
                        "For companies, universities, associations and service providers.",
                      icon: Building2,
                    },
                  ].map((option) => {
                    const Icon = option.icon;
                    const selected = intent === option.value;
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
                        key={option.value}
                        onClick={() => {
                          setIntent(option.value);
                          captureProductEvent(
                            PRODUCT_EVENTS.REGISTRATION_INTENT_SELECTED,
                            { intent: option.value },
                          );
                        }}
                        type="button"
                      >
                        <span className="flex items-start gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-card shadow-sm">
                            <Icon className="h-5 w-5" />
                          </span>
                          <span>
                            <span className="block text-sm font-black">
                              {option.title}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                              {option.description}
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {intent === "ORGANIZATION" ? (
                  <p className="mt-3 rounded-2xl bg-muted px-4 py-3 text-xs leading-5 text-muted-foreground">
                    You are creating your personal Kondo login. Each team member
                    should use their own account—never share a password.
                  </p>
                ) : null}
              </fieldset>
              <Field
                label="First name"
                name="firstName"
                autoComplete="given-name"
              />
              <Field
                label="Last name"
                name="lastName"
                autoComplete="family-name"
              />
              <div className="sm:col-span-2">
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  autoComplete="email"
                />
              </div>
              {intent === "PERSONAL" ? (
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-bold text-kondo-ink dark:text-white">
                    Gender
                  </span>
                  <select
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-transparent px-4 text-base outline-none transition focus:border-kondo-green dark:border-white/10"
                    name="gender"
                    onChange={(event) => setGender(event.target.value)}
                    required
                    value={gender}
                  >
                    <option disabled value="">
                      Select your gender
                    </option>
                    <option value="MALE">Man</option>
                    <option value="FEMALE">Woman</option>
                  </select>
                  <span className="mt-1.5 block text-[11px] text-muted-foreground">
                    Used privately to improve Meet compatibility. You can
                    control discovery visibility later.
                  </span>
                </label>
              ) : null}
              {intent === "PERSONAL" ? (
                <div className="sm:col-span-2">
                  <input name="countryCode" type="hidden" value={countryCode} />
                  <SearchableSelect
                    emptyMessage="No African country matches your search."
                    label="Country of origin"
                    onSelect={setCountryCode}
                    options={AFRICAN_COUNTRIES.map((country) => ({
                      id: country.code,
                      name: `${country.emoji} ${country.name}`,
                    }))}
                    placeholder="Select your country"
                    searchPlaceholder="Search African countries…"
                    selected={countryCode}
                  />
                  <span className="mt-1.5 block text-[11px] text-muted-foreground">
                    You will automatically join your official national
                    community.
                  </span>
                </div>
              ) : null}
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-kondo-ink dark:text-white">
                  Password
                </span>
                <span className="relative block">
                  <input
                    autoComplete="new-password"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-transparent px-4 pr-12 text-sm outline-none focus:border-kondo-green dark:border-white/10"
                    name="password"
                    required
                    type={showPassword ? "text" : "password"}
                  />
                  <button
                    aria-label="Toggle password visibility"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPassword((value) => !value)}
                    type="button"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </span>
                <span className="mt-1.5 block text-[11px] text-muted-foreground">
                  10+ characters, uppercase, lowercase, and a number.
                </span>
              </label>
              <Field
                label="Confirm password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
              />
              <label className="flex items-start gap-3 text-xs leading-5 text-muted-foreground sm:col-span-2">
                <input
                  className="mt-0.5 h-4 w-4 accent-kondo-green"
                  name="acceptedTerms"
                  required
                  type="checkbox"
                />{" "}
                <span>
                  I agree to Kondo’s{" "}
                  <Link className="font-bold text-kondo-green" href="/terms">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link className="font-bold text-kondo-green" href="/privacy">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              {error ? (
                <p
                  className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300 sm:col-span-2"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              <div className="sm:col-span-2">
                <Button
                  disabled={
                    loading ||
                    (intent === "PERSONAL" && (!countryCode || !gender))
                  }
                  fullWidth
                  size="lg"
                  type="submit"
                >
                  {loading ? (
                    "Creating your account…"
                  ) : (
                    <>
                      Create account <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link className="font-black text-kondo-green" href="/login">
                Sign in
              </Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-kondo-ink dark:text-white">
        {label}
      </span>
      <input
        autoComplete={autoComplete}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-transparent px-4 text-sm outline-none transition focus:border-kondo-green dark:border-white/10"
        name={name}
        required
        type={type}
      />
    </label>
  );
}
