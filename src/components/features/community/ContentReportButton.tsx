"use client";

import { Flag } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function ContentReportButton({
  endpoint,
  label = "Report",
  inverse = false,
}: {
  endpoint: string;
  label?: string;
  inverse?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function report() {
    const details = window.prompt("Briefly explain the concern");
    if (details === null) return;
    setPending(true);
    setMessage("");
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "OTHER", details }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setPending(false);
    setMessage(
      response?.ok
        ? payload?.reused
          ? "Report already open"
          : "Report submitted"
        : payload?.error ?? "Could not submit report",
    );
  }

  return (
    <div>
      <Button
        className={inverse ? "text-white/70 hover:bg-white/10 hover:text-white" : undefined}
        disabled={pending}
        onClick={report}
        size="sm"
        type="button"
        variant="ghost"
      >
        <Flag className="h-4 w-4" /> {pending ? "Submitting…" : label}
      </Button>
      {message ? <span className="sr-only" role="status">{message}</span> : null}
    </div>
  );
}
