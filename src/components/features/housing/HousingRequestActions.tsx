"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function HousingRequestActions({
  requestId,
  status,
}: {
  requestId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action =
    status === "PUBLISHED"
      ? ("pause" as const)
      : status === "DRAFT" || status === "PAUSED"
        ? ("publish" as const)
        : null;
  if (!action) {
    return (
      <span className="text-xs font-bold capitalize text-muted-foreground">
        {status.toLowerCase()}
      </span>
    );
  }
  async function transition() {
    if (busy || !action) return;
    setBusy(true);
    setError(null);
    const response = await fetch(
      `/api/housing/requests/${requestId}/${action}`,
      { method: "POST", credentials: "include" },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error ?? "The request could not be updated.");
      setBusy(false);
      return;
    }
    router.refresh();
  }
  return (
    <div>
      <Button
        disabled={busy}
        onClick={transition}
        size="sm"
        variant={action === "pause" ? "secondary" : "primary"}
      >
        {busy
          ? "Updating…"
          : action === "pause"
            ? "Pause request"
            : "Publish request"}
      </Button>
      {error ? (
        <p
          aria-live="assertive"
          className="mt-2 text-xs font-bold text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
