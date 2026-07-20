"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { KondoLogo } from "@/components/KondoLogo";
import { Button } from "@/components/ui/Button";

type Status = "checking" | "verified" | "error";

function VerifyEmailBody() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<Status>(token ? "checking" : "error");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const response = await fetch("/api/auth/verify-email/confirm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json().catch(() => null);
      if (cancelled) return;
      if (!response.ok) {
        setError(data?.error ?? "This verification link is invalid or has expired.");
        setStatus("error");
        return;
      }
      setStatus("verified");
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "checking") {
    return (
      <div className="text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-kondo-green" />
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Verifying your email…
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="text-center">
        <XCircle className="mx-auto h-10 w-10 text-red-500" />
        <h1 className="mt-4 text-2xl font-black text-kondo-ink dark:text-white">
          Couldn&apos;t verify your email
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {error || "This link is missing its token."} Request a new one from
          Settings → Account.
        </p>
        <Button asChild className="mt-6" size="lg">
          <Link href="/settings/account">Go to Settings</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-kondo-green" />
      <h1 className="mt-4 text-2xl font-black text-kondo-ink dark:text-white">
        Email verified
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
        Thanks for confirming your address.
      </p>
      <Button asChild className="mt-6" size="lg">
        <Link href="/home">Continue to Kondo</Link>
      </Button>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-white px-5 py-10 dark:bg-[#0c1412]">
      <div className="w-full max-w-md">
        <KondoLogo />
        <div className="mt-10">
          <Suspense fallback={null}>
            <VerifyEmailBody />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
