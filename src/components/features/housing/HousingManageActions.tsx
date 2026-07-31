"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

const actions: Record<
  string,
  Array<{
    endpoint: string;
    label: string;
    variant?: "primary" | "secondary" | "danger";
  }>
> = {
  DRAFT: [{ endpoint: "submit", label: "Submit for review" }],
  PENDING_REVIEW: [
    { endpoint: "", label: "Under review", variant: "secondary" },
  ],
  PUBLISHED: [
    { endpoint: "pause", label: "Pause", variant: "secondary" },
    { endpoint: "mark-rented", label: "Mark as rented" },
  ],
  PAUSED: [{ endpoint: "publish", label: "Publish again" }],
  REJECTED: [{ endpoint: "renew", label: "Return to draft" }],
  EXPIRED: [{ endpoint: "renew", label: "Renew draft" }],
};

export function HousingManageActions({
  listingId,
  status,
}: {
  listingId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(endpoint: string) {
    if (!endpoint || busy) return;
    setBusy(true);
    setError(null);
    const response = await fetch(
      `/api/housing/listings/${listingId}/${endpoint}`,
      { method: "POST", credentials: "include" },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok)
      setError(payload?.error ?? "Could not update the listing.");
    else {
      router.refresh();
    }
    setBusy(false);
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {(actions[status] ?? []).map((action) => (
          <Button
            disabled={busy || !action.endpoint}
            key={action.label}
            onClick={() => run(action.endpoint)}
            variant={action.variant}
          >
            {busy ? "Updating…" : action.label}
          </Button>
        ))}
      </div>
      {error ? (
        <p
          aria-live="assertive"
          className="mt-3 text-sm font-bold text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
