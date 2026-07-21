"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { FormEvent, Suspense, useState } from "react";
import { KondoLogo } from "@/components/KondoLogo";
import { Button } from "@/components/ui/Button";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/password-reset/confirm", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        password: form.get("password"),
        confirmPassword: form.get("confirmPassword"),
      }),
    });
    const data = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setError(data?.error ?? "Could not reset your password.");
      return;
    }
    setDone(true);
    setTimeout(() => router.replace("/login"), 2500);
  }

  if (!token) {
    return (
      <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300">
        This reset link is missing its token. Request a new one from{" "}
        <Link className="underline" href="/forgot-password">
          Forgot password
        </Link>
        .
      </p>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-kondo-green" />
        <h1 className="mt-4 text-2xl font-black text-kondo-ink dark:text-white">
          Password updated
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Every device was signed out for your security. Redirecting to sign in…
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
        Reset password
      </p>
      <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] text-kondo-ink dark:text-white">
        Choose a new password
      </h1>
      <form className="mt-8 space-y-5" onSubmit={submit}>
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-kondo-ink dark:text-white">
            New password
          </span>
          <span className="relative block">
            <input
              autoComplete="new-password"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-12 text-sm outline-none transition focus:border-kondo-green dark:border-white/10 dark:bg-white/5"
              minLength={10}
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
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-kondo-ink dark:text-white">
            Confirm new password
          </span>
          <input
            autoComplete="new-password"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-kondo-green dark:border-white/10 dark:bg-white/5"
            minLength={10}
            name="confirmPassword"
            required
            type={showPassword ? "text" : "password"}
          />
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
            "Updating…"
          ) : (
            <>
              Update password <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10 text-foreground">
      <div className="w-full max-w-md">
        <KondoLogo />
        <div className="mt-10">
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </div>
        <p className="mt-10 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Secure, private, and built for
          students.
        </p>
      </div>
    </main>
  );
}
