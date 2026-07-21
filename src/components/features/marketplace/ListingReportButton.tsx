"use client";

import { Flag } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function ListingReportButton({ listingId }: { listingId: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function report() {
    const details = window.prompt("Describe the Marketplace safety concern");
    if (details === null) return;
    setPending(true);
    const response = await fetch(`/api/marketplace/${listingId}/report`, {
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
          ? "Report already open."
          : "Report submitted."
        : (payload?.error ?? "Could not submit report."),
    );
  }

  return (
    <div className="text-center">
      <Button
        disabled={pending}
        onClick={report}
        size="sm"
        type="button"
        variant="ghost"
      >
        <Flag className="h-4 w-4" />{" "}
        {pending ? "Submitting…" : "Report listing"}
      </Button>
      {message ? (
        <p className="mt-1 text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
