"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { KondoLogo } from "@/components/KondoLogo";
import { Button } from "@/components/ui/Button";
import {
  captureProductEvent,
  identifyProductUser,
  resetProductAnalytics,
} from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

export default function LoginPage() {
  const router = useRouter();
  const nextPath = useSafeInternalNext();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    resetProductAnalytics();
    captureProductEvent(PRODUCT_EVENTS.LOGIN_STARTED);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "We couldn’t sign you in.");
        return;
      }
      identifyProductUser(data.user.id, {
        role: data.user.role,
        onboarding_completed: data.user.onboardingComplete,
      });
      router.replace(
        nextPath ??
          data.nextPath ??
          (data.user.onboardingComplete ? "/home" : "/onboarding"),
      );
      router.refresh();
    } catch {
      setError("Kondo could not sign you in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-background text-foreground lg:grid-cols-[0.9fr_1.1fr]">
      <section className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-14">
        <KondoLogo />
        <div className="my-auto mx-auto w-full max-w-md py-12">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
            Welcome back
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-kondo-ink dark:text-white">
            Your people are here.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Sign in to continue to your communities, guides, and student life in
            China.
          </p>
          <form
            action="/api/auth/login"
            className="mt-8 space-y-5"
            method="post"
            onSubmit={submit}
          >
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-kondo-ink dark:text-white">
                Email
              </span>
              <input
                autoComplete="email"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-kondo-green dark:border-white/10 dark:bg-white/5"
                name="email"
                placeholder="you@university.edu"
                required
                type="email"
              />
            </label>
            <label className="block">
              <span className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-kondo-ink dark:text-white">
                  Password
                </span>
                <Link
                  className="text-xs font-bold text-kondo-green hover:underline"
                  href="/forgot-password"
                >
                  Forgot password?
                </Link>
              </span>
              <span className="relative block">
                <input
                  autoComplete="current-password"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-12 text-sm outline-none transition focus:border-kondo-green dark:border-white/10 dark:bg-white/5"
                  name="password"
                  required
                  type={showPassword ? "text" : "password"}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
            </label>
            {error ? (
              <p
                className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <Button disabled={loading} fullWidth size="lg" type="submit">
              {loading ? (
                "Signing in…"
              ) : (
                <>
                  Sign in <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
          <p className="mt-7 text-center text-sm text-muted-foreground">
            New to Kondo?{" "}
            <Link
              className="font-black text-kondo-green hover:underline"
              href={
                nextPath
                  ? `/register?next=${encodeURIComponent(nextPath)}`
                  : "/register"
              }
            >
              Create your account
            </Link>
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Secure, private, and built for
          students.
        </p>
      </section>
      <aside className="noise relative hidden overflow-hidden bg-gradient-to-br from-kondo-navy via-kondo-forest to-[#238164] p-14 text-white lg:block">
        <div className="relative z-10 flex h-full flex-col justify-between">
          <p className="text-sm font-bold text-kondo-lime">
            The digital home for African students in China.
          </p>
          <div className="max-w-xl">
            <blockquote className="text-balance text-4xl font-black leading-tight tracking-[-0.04em]">
              “Kondo made my first month feel less like guessing and more like
              belonging.”
            </blockquote>
            <div className="mt-7 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-kondo-lime font-black text-kondo-forest">
                AM
              </span>
              <div>
                <p className="font-bold">Ama Mensah</p>
                <p className="text-sm text-white/55">
                  Master’s student · Beijing
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="h-1.5 w-8 rounded-full bg-kondo-lime" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
          </div>
        </div>
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full border-[70px] border-white/5"
        />
      </aside>
    </main>
  );
}

const subscribeLocation = () => () => undefined;
const getServerNextPath = () => null;
function getBrowserNextPath() {
  return safeInternalNext(
    new URLSearchParams(window.location.search).get("next"),
  );
}
function useSafeInternalNext() {
  return useSyncExternalStore(
    subscribeLocation,
    getBrowserNextPath,
    getServerNextPath,
  );
}

function safeInternalNext(value: string | null) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return null;
  return value;
}
