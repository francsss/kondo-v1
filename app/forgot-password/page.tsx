"use client";

import Link from "next/link";
import { ArrowRight, MailCheck, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { KondoLogo } from "@/components/KondoLogo";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/password-reset/request", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email") }),
    });
    const data = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setError(data?.error ?? "Something went wrong. Try again.");
      return;
    }
    setSent(true);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10 text-foreground">
      <div className="w-full max-w-md">
        <KondoLogo />
        <div className="mt-10">
          {sent ? (
            <div className="text-center">
              <MailCheck className="mx-auto h-10 w-10 text-kondo-green" />
              <h1 className="mt-4 text-2xl font-black text-kondo-ink dark:text-white">
                Check your email
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                If that address has a Kondo account, a reset link is on its way.
                It expires in one hour.
              </p>
              <Link
                className="mt-6 inline-block font-black text-kondo-green hover:underline"
                href="/login"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
                Reset password
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] text-kondo-ink dark:text-white">
                Forgot your password?
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Enter the email on your account and we&apos;ll send a link to
                reset it.
              </p>
              <form className="mt-8 space-y-5" onSubmit={submit}>
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
                    "Sending…"
                  ) : (
                    <>
                      Send reset link <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
              <p className="mt-7 text-center text-sm text-muted-foreground">
                <Link
                  className="font-black text-kondo-green hover:underline"
                  href="/login"
                >
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
        <p className="mt-10 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Secure, private, and built for
          students.
        </p>
      </div>
    </main>
  );
}
