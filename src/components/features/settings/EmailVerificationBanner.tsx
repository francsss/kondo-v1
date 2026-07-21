"use client";

import { MailWarning } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function EmailVerificationBanner({ email }: { email: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function resend() {
    setStatus("sending");
    setMessage("");
    const response = await fetch("/api/auth/verify-email/request", {
      method: "POST",
      credentials: "include",
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setStatus("error");
      setMessage(data?.error ?? "Could not send a verification email.");
      return;
    }
    setStatus("sent");
  }

  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-400/10">
      <div className="flex items-start gap-3">
        <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
        <div className="flex-1">
          <h2 className="font-black text-kondo-ink dark:text-white">
            Verify your email
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            We haven&apos;t confirmed{" "}
            <span className="font-semibold">{email}</span> yet.
          </p>
          {status === "sent" ? (
            <p className="mt-3 text-sm font-semibold text-kondo-forest dark:text-emerald-300">
              Verification email sent. Check your inbox.
            </p>
          ) : (
            <Button
              className="mt-3"
              disabled={status === "sending"}
              onClick={resend}
              size="sm"
              variant="secondary"
            >
              {status === "sending" ? "Sending…" : "Resend verification email"}
            </Button>
          )}
          {status === "error" ? (
            <p className="mt-2 text-sm font-semibold text-red-600 dark:text-red-300">
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
