"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import { FormEvent, useState } from "react";
import { KondoLogo } from "@/components/KondoLogo";
import { Button } from "@/components/ui/Button";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        email: form.get("email"),
        password: form.get("password"),
        confirmPassword: form.get("confirmPassword"),
        acceptedTerms: form.get("acceptedTerms") === "on",
      }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok)
      return setError(data.error ?? "We couldn’t create your account.");
    router.replace("/onboarding");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-kondo-sand px-5 py-6 dark:bg-[#0c1412] sm:px-10">
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
            <p className="mt-5 max-w-md text-base leading-7 text-slate-500 dark:text-slate-400">
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
                  className="flex items-center gap-3 text-sm font-semibold text-slate-600 dark:text-slate-300"
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
          <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-soft dark:border-white/10 dark:bg-[#14201d] sm:p-8">
            <h2 className="text-2xl font-black tracking-tight text-kondo-ink dark:text-white">
              Create your account
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Your profile takes less than two minutes.
            </p>
            <form
              action="/api/auth/register"
              className="mt-7 grid gap-5 sm:grid-cols-2"
              method="post"
              onSubmit={submit}
            >
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
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
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
                <span className="mt-1.5 block text-[11px] text-slate-400">
                  10+ characters, uppercase, lowercase, and a number.
                </span>
              </label>
              <Field
                label="Confirm password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
              />
              <label className="flex items-start gap-3 text-xs leading-5 text-slate-500 sm:col-span-2">
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
                <Button disabled={loading} fullWidth size="lg" type="submit">
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
            <p className="mt-6 text-center text-sm text-slate-500">
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
